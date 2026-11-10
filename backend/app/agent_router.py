"""
Agent Router — FastAPI endpoints for the Cardiac AI Agent & Clinical Analyzer
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, model_validator
from sqlalchemy.orm import Session

from app.database import get_db
from app.agent_service import (
    run_agent,
    get_key_pool_status,
    generate_4min_clinical_report,
    rate_limiter,
)
from app.ecg_predictor import predict_heartbeat

router = APIRouter(prefix="/agent", tags=["Agentic AI"])


class AgentMessage(BaseModel):
    role: str = "user"
    content: str = ""
    parts: list[Any] | None = None
    text: str | None = None

    @model_validator(mode="before")
    @classmethod
    def normalize_message(cls, data: Any) -> Any:
        if isinstance(data, dict):
            # Normalize role
            r = str(data.get("role", "user")).lower()
            if r in ("model", "bot", "assistant"):
                data["role"] = "assistant"
            else:
                data["role"] = "user"

            # Normalize content from parts or text if content is missing
            if not data.get("content"):
                if data.get("parts") and isinstance(data["parts"], list):
                    data["content"] = "\n".join(str(p) for p in data["parts"])
                elif data.get("text"):
                    data["content"] = str(data["text"])
                else:
                    data["content"] = ""
        return data


class AgentChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    conversation_history: list[AgentMessage] = Field(
        default_factory=list,
        description="Previous conversation turns for context.",
    )


class AgentChatResponse(BaseModel):
    reply: str
    tool_calls: list[dict[str, Any]] = []
    key_used: str
    model: str


class SessionAnalysisRequest(BaseModel):
    features: list[float] = Field(
        ...,
        min_length=234,
        max_length=234,
        description="Exactly 234 preprocessed ECG heartbeat features",
    )
    avg_hr: float = Field(default=72.0, ge=0.0, le=250.0)
    sample_count: int = Field(default=0, ge=0)


class SessionAnalysisResponse(BaseModel):
    prediction: dict[str, Any]
    report: str


@router.post("/chat", response_model=AgentChatResponse)
def agent_chat(
    body: AgentChatRequest,
    db: Session | None = Depends(get_db),
) -> AgentChatResponse:
    """
    Query the Cardiac Digital Twin AI Agent. Powered by clinical RAG and Gemini failover.
    """
    try:
        history = [{"role": m.role, "content": m.content} for m in body.conversation_history]
        result = run_agent(user_message=body.message, conversation_history=history, db=db)
        return AgentChatResponse(**result)
    except Exception as exc:
        # Ultimate fail-safe to guarantee HTTP 200 response
        from app.agent_service import generate_deep_rag_response, retrieve_rag_context, clean_clinical_output
        rag_ctx = retrieve_rag_context(body.message, top_k=2)
        fallback_reply = generate_deep_rag_response(body.message, rag_ctx, None)
        return AgentChatResponse(
            reply=clean_clinical_output(fallback_reply),
            tool_calls=[],
            key_used="EmergencyClinicalRAG",
            model="RAG-Expert-V1",
        )


@router.post("/analyze-session", response_model=SessionAnalysisResponse)
def analyze_session(
    body: SessionAnalysisRequest,
) -> SessionAnalysisResponse:
    """
    Executes ML inference on a 4-minute (or on-demand) 234-sample ECG snapshot
    and generates an automated clinical research report.
    """
    try:
        prediction = predict_heartbeat(body.features)
        report = generate_4min_clinical_report(
            prediction=prediction,
            avg_hr=body.avg_hr,
            sample_count=body.sample_count,
        )
        return SessionAnalysisResponse(prediction=prediction, report=report)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Inference failure: {exc}",
        )


@router.get("/status")
def agent_status() -> dict:
    return {
        "status": "active",
        "service": "Cardiac Digital Twin AI Agent (RAG + Gemini)",
        **get_key_pool_status(),
    }
