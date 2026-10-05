@echo off
chcp 65001 >nul
title Busca CNPJ - Servidor Local
cd /d "%~dp0"

echo ========================================================
echo   Busca CNPJ + Perfil da Empresa no Google
echo ========================================================
echo.

:: Detecta se existe ambiente virtual (.venv) ou comando python/py
set PYTHON_CMD=python

if exist ".venv\Scripts\python.exe" (
    echo [INFO] Utilizando ambiente virtual (.venv) detectado.
    set PYTHON_CMD=.venv\Scripts\python.exe
) else (
    python --version >nul 2>&1
    if errorlevel 1 (
        py --version >nul 2>&1
        if errorlevel 1 (
            echo [ERRO] Python não foi encontrado no seu computador!
            echo.
            echo Por favor, instale o Python 3.10 ou superior:
            echo https://www.python.org/downloads/
            echo.
            echo Dica: Marque a opção "Add Python to PATH" durante a instalação.
            echo.
            pause
            exit /b 1
        ) else (
            set PYTHON_CMD=py
        )
    )
)

echo [1/3] Verificando dependencias (Flask, Requests, OpenPyXL)...
%PYTHON_CMD% -m pip install -r requirements.txt --quiet --disable-pip-version-check
if errorlevel 1 (
    echo [AVISO] Nao foi possivel atualizar dependencias via pip. Tentando iniciar mesmo assim...
)

echo [2/3] Abrindo navegador em http://localhost:5000...
start "" cmd /c "ping 127.0.0.1 -n 3 >nul & start http://localhost:5000"

echo [3/3] Iniciando o servidor...
echo.
echo ========================================================
echo   Servidor ativo: http://localhost:5000
echo   Para parar o servidor, feche esta janela ou aperte Ctrl+C.
echo ========================================================
echo.

%PYTHON_CMD% app.py

if errorlevel 1 (
    echo.
    echo [ERRO] Ocorreu uma falha ao executar a aplicacao.
    pause
)
