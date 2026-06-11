# -*- coding: utf-8 -*-
r"""
Baixa os dados abertos de CNPJ da Receita Federal (Estabelecimentos*.zip + Cnaes.zip)
direto para a pasta dados\, de graça.

Fonte: compartilhamento público (Nextcloud) da Receita Federal, via WebDAV.
Os arquivos são grandes (~330 MB a ~2 GB cada). O download:
  - PULA arquivos que já existem completos na pasta dados\
  - RETOMA downloads interrompidos (usa HTTP Range)

Uso:
  python baixar_dados.py                 -> baixa o que falta de Estabelecimentos0..9 + Cnaes
  python baixar_dados.py --mes 2026-05   -> escolhe outro mês (pasta do compartilhamento)
  python baixar_dados.py 0 1 2           -> baixa só Estabelecimentos0,1,2 (+ Cnaes)
  python baixar_dados.py --cnaes         -> baixa só o Cnaes.zip
"""
import base64
import os
import sys
import time
import urllib.request

# Compartilhamento público da Receita (token = usuário do Basic Auth, senha vazia)
TOKEN = "YggdBLfdninEJX9"
MES_PADRAO = "2026-05"
BASE = "https://arquivos.receitafederal.gov.br/public.php/webdav/{mes}/{arquivo}"

PASTA_DESTINO = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dados")


def _auth_header():
    cred = base64.b64encode(f"{TOKEN}:".encode("ascii")).decode("ascii")
    return f"Basic {cred}"


def tamanho_remoto(url):
    """Retorna o tamanho (bytes) do arquivo remoto, ou None se indisponível."""
    req = urllib.request.Request(url, method="HEAD", headers={"Authorization": _auth_header()})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            cl = r.headers.get("Content-Length")
            return int(cl) if cl else None
    except Exception:
        return None


def baixar(url, destino):
    """Baixa url -> destino, pulando se já completo e retomando se parcial."""
    total = tamanho_remoto(url)
    ja = os.path.getsize(destino) if os.path.exists(destino) else 0

    if total is not None and ja == total:
        print(f"    já completo ({ja/1e6:.0f} MB) — pulando")
        return True
    if total is not None and ja > total:
        # arquivo local maior que o remoto: provavelmente corrompido, recomeça
        ja = 0

    headers = {"Authorization": _auth_header()}
    modo = "wb"
    if ja > 0:
        headers["Range"] = f"bytes={ja}-"
        modo = "ab"
        print(f"    retomando de {ja/1e6:.0f} MB...")

    req = urllib.request.Request(url, headers=headers)
    inicio = time.time()
    try:
        with urllib.request.urlopen(req, timeout=120) as r, open(destino, modo) as f:
            baixado = ja
            bloco = 1024 * 256  # 256 KB
            while True:
                pedaco = r.read(bloco)
                if not pedaco:
                    break
                f.write(pedaco)
                baixado += len(pedaco)
                if total:
                    pct = baixado / total * 100
                    mbps = (baixado - ja) / 1e6 / max(time.time() - inicio, 0.1)
                    print(f"\r    {baixado/1e6:.0f}/{total/1e6:.0f} MB ({pct:.1f}%) {mbps:.1f} MB/s   ",
                          end="", flush=True)
        print()
        return True
    except Exception as e:
        print(f"\n    ERRO: {e}")
        return False


def main():
    args = sys.argv[1:]
    mes = MES_PADRAO
    if "--mes" in args:
        mes = args[args.index("--mes") + 1]

    so_cnaes = "--cnaes" in args
    indices = [a for a in args if a.isdigit()]

    if so_cnaes:
        alvos = ["Cnaes.zip"]
    elif indices:
        alvos = [f"Estabelecimentos{i}.zip" for i in indices] + ["Cnaes.zip"]
    else:
        alvos = [f"Estabelecimentos{i}.zip" for i in range(10)] + ["Cnaes.zip"]

    os.makedirs(PASTA_DESTINO, exist_ok=True)
    print(f"\nBaixando dados abertos da Receita (mês {mes}) para {PASTA_DESTINO}\\")
    print(f"  {len(alvos)} arquivo(s) — os que já existirem completos serão pulados.\n")

    ok, falhas = 0, []
    for arquivo in alvos:
        url = BASE.format(mes=mes, arquivo=arquivo)
        destino = os.path.join(PASTA_DESTINO, arquivo)
        print(f"  {arquivo}")
        if baixar(url, destino):
            ok += 1
        else:
            falhas.append(arquivo)

    print(f"\nConcluído: {ok}/{len(alvos)} arquivo(s) prontos.")
    if falhas:
        print(f"  Falhas (rode de novo para retomar): {', '.join(falhas)}")
    else:
        print("  Tudo pronto. Agora rode:  python extrair_cnpjs.py --filtrar --ativas")


if __name__ == "__main__":
    main()
