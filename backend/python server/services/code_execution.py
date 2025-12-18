"""
Code Execution Service - Sandboxed code execution for multiple languages
"""
import os
import re
import time
import subprocess
import tempfile
import shutil
from typing import Tuple


# Supported programming languages
SUPPORTED_LANGUAGES = ["python", "javascript", "cpp", "java"]

# Interpreter/compiler mapping for error messages
INTERPRETER_MAP = {
    "python": "Python",
    "javascript": "Node.js",
    "cpp": "g++ (GCC)",
    "java": "Java JDK"
}


def execute_code_in_sandbox(
    code: str,
    language: str,
    stdin: str = ""
) -> Tuple[bool, str, str, str]:
    """
    Execute code in a sandboxed temporary directory
    
    Args:
        code: Source code to execute
        language: Programming language (python, javascript, cpp, java)
        stdin: Optional standard input
    
    Returns:
        Tuple of (success, output, error, execution_time)
    """
    if language not in SUPPORTED_LANGUAGES:
        return (
            False,
            "",
            f"Unsupported language: {language}. Supported: {', '.join(SUPPORTED_LANGUAGES)}",
            "0ms"
        )
    
    start_time = time.time()
    temp_dir = None
    
    try:
        # Create a temporary directory for code execution
        temp_dir = tempfile.mkdtemp()
        
        output = ""
        error = ""
        
        if language == "python":
            output, error = _execute_python(code, temp_dir, stdin)
            
        elif language == "javascript":
            output, error = _execute_javascript(code, temp_dir, stdin)
            
        elif language == "cpp":
            output, error = _execute_cpp(code, temp_dir, stdin)
            
        elif language == "java":
            output, error = _execute_java(code, temp_dir, stdin)
        
        execution_time = f"{(time.time() - start_time) * 1000:.2f}ms"
        
        return (True, output, error, execution_time)
        
    except subprocess.TimeoutExpired:
        return (False, "", "Execution timed out (10 second limit)", "10000ms")
        
    except FileNotFoundError:
        missing = INTERPRETER_MAP.get(language, language)
        return (
            False,
            "",
            f"{missing} is not installed or not in PATH. Please install it to run {language} code.",
            f"{(time.time() - start_time) * 1000:.2f}ms"
        )
        
    except Exception as e:
        return (
            False,
            "",
            str(e),
            f"{(time.time() - start_time) * 1000:.2f}ms"
        )
        
    finally:
        # Clean up temporary directory
        if temp_dir and os.path.exists(temp_dir):
            try:
                shutil.rmtree(temp_dir)
            except Exception:
                pass


def _execute_python(code: str, temp_dir: str, stdin: str) -> Tuple[str, str]:
    """Execute Python code"""
    file_path = os.path.join(temp_dir, "main.py")
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(code)
    
    result = subprocess.run(
        ["python", file_path],
        capture_output=True,
        text=True,
        timeout=10,
        input=stdin if stdin else None,
        cwd=temp_dir
    )
    return result.stdout, result.stderr


def _execute_javascript(code: str, temp_dir: str, stdin: str) -> Tuple[str, str]:
    """Execute JavaScript code using Node.js"""
    file_path = os.path.join(temp_dir, "main.js")
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(code)
    
    result = subprocess.run(
        ["node", file_path],
        capture_output=True,
        text=True,
        timeout=10,
        input=stdin if stdin else None,
        cwd=temp_dir
    )
    return result.stdout, result.stderr


def _execute_cpp(code: str, temp_dir: str, stdin: str) -> Tuple[str, str]:
    """Compile and execute C++ code"""
    source_path = os.path.join(temp_dir, "main.cpp")
    exe_path = os.path.join(temp_dir, "main.exe" if os.name == "nt" else "main")
    
    with open(source_path, "w", encoding="utf-8") as f:
        f.write(code)
    
    # Compile
    compile_result = subprocess.run(
        ["g++", source_path, "-o", exe_path],
        capture_output=True,
        text=True,
        timeout=30,
        cwd=temp_dir
    )
    
    if compile_result.returncode != 0:
        return "", f"Compilation Error:\n{compile_result.stderr}"
    
    # Execute
    result = subprocess.run(
        [exe_path],
        capture_output=True,
        text=True,
        timeout=10,
        input=stdin if stdin else None,
        cwd=temp_dir
    )
    return result.stdout, result.stderr


def _execute_java(code: str, temp_dir: str, stdin: str) -> Tuple[str, str]:
    """Compile and execute Java code"""
    # Extract class name from code
    class_match = re.search(r'public\s+class\s+(\w+)', code)
    class_name = class_match.group(1) if class_match else "Main"
    
    source_path = os.path.join(temp_dir, f"{class_name}.java")
    
    with open(source_path, "w", encoding="utf-8") as f:
        f.write(code)
    
    # Compile
    compile_result = subprocess.run(
        ["javac", source_path],
        capture_output=True,
        text=True,
        timeout=30,
        cwd=temp_dir
    )
    
    if compile_result.returncode != 0:
        return "", f"Compilation Error:\n{compile_result.stderr}"
    
    # Execute
    result = subprocess.run(
        ["java", "-cp", temp_dir, class_name],
        capture_output=True,
        text=True,
        timeout=10,
        input=stdin if stdin else None,
        cwd=temp_dir
    )
    return result.stdout, result.stderr
