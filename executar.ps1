# Script de inicializacao do Busca CNPJ no PowerShell
$ErrorActionPreference = "Continue"
Set-Location $PSScriptRoot

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "   Busca CNPJ + Perfil da Empresa no Google" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

$pythonCmd = "python"

if (Test-Path ".venv\Scripts\python.exe") {
    Write-Host "[INFO] Utilizando ambiente virtual (.venv) detectado." -ForegroundColor Green
    $pythonCmd = ".venv\Scripts\python.exe"
} else {
    try {
        & python --version 2>&1 | Out-Null
    } catch {
        try {
            & py --version 2>&1 | Out-Null
            $pythonCmd = "py"
        } catch {
            Write-Host "[ERRO] Python nao foi encontrado no sistema!" -ForegroundColor Red
            Write-Host "Instale o Python (3.10+) em: https://www.python.org/downloads/"
            Write-Host "Certifique-se de marcar 'Add Python to PATH' durante a instalacao."
            Read-Host "Pressione Enter para sair..."
            exit 1
        }
    }
}

Write-Host "[1/3] Verificando dependencias (Flask, Requests, OpenPyXL)..." -ForegroundColor Yellow
& $pythonCmd -m pip install -r requirements.txt --quiet --disable-pip-version-check

Write-Host "[2/3] Abrindo navegador em http://localhost:5000..." -ForegroundColor Yellow
Start-Process "http://localhost:5000"

Write-Host "[3/3] Iniciando servidor Flask..." -ForegroundColor Green
Write-Host ""
Write-Host "========================================================" -ForegroundColor Green
Write-Host "   Servidor rodando em: http://localhost:5000" -ForegroundColor Green
Write-Host "   Pressione Ctrl+C para parar o servidor." -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green
Write-Host ""

& $pythonCmd app.py
