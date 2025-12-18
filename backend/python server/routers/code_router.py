"""
Code Router - Handles code execution HTTP endpoints
"""
from fastapi import APIRouter

from models import CodeExecutionRequest, CodeExecutionResponse
from services.code_execution import execute_code_in_sandbox

router = APIRouter(prefix="/api", tags=["Code Execution"])


@router.post("/execute-code", response_model=CodeExecutionResponse)
async def execute_code(request: CodeExecutionRequest):
    """
    Execute code in various programming languages
    
    - **code**: The source code to execute
    - **language**: Programming language (python, javascript, cpp, java)
    - **stdin**: Optional standard input for the program
    """
    success, output, error, execution_time = execute_code_in_sandbox(
        code=request.code,
        language=request.language,
        stdin=request.stdin
    )
    
    return {
        "success": success,
        "output": output,
        "error": error,
        "execution_time": execution_time
    }
