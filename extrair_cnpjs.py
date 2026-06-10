# -*- coding: utf-8 -*-
r"""
Extrai os números de CNPJ dos arquivos Estabelecimentos*.zip da Receita Federal,
lendo os ZIPs diretamente (sem extrair), e separa as listas por atividade (CNAE).

Uso:
  python extrair_cnpjs.py                     -> lê .\dados, todas as situações
  python extrair_cnpjs.py --ativas            -> só empresas ATIVAS
  python extrair_cnpjs.py C:\meus\zips        -> outra pasta de ZIPs
  python extrair_cnpjs.py --saida minha_pasta -> outra pasta de saída

Saída (pasta cnpjs_por_atividade por padrão):
  - um .txt por atividade, com um CNPJ por linha
  - _resumo.csv com código, nome da atividade e quantidade de CNPJs

Dica: coloque o Cnaes.zip (pequeno, baixado do mesmo site) na pasta dos ZIPs
para que os arquivos sejam nomeados com a descrição da atividade.
Para o Brasil inteiro são necessários os 10 arquivos (Estabelecimentos0 a 9).
"""
import csv
import glob
import io
import os
import re
import sys
import time
import zipfile

csv.field_size_limit(10_000_000)


def carregar_cnaes(pasta):
    """Lê o Cnaes.zip (se existir) e devolve {codigo: descricao}."""
    nomes = {}
    for arq in glob.glob(os.path.join(pasta, "Cnaes*.zip")):
        with zipfile.ZipFile(arq) as zf:
            for interno in zf.namelist():
                with zf.open(interno) as bruto:
                    texto = io.TextIOWrapper(bruto, encoding="latin-1", errors="replace", newline="")
                    for row in csv.reader(texto, delimiter=";", quotechar='"'):
                        if len(row) >= 2:
                            nomes[row[0]] = row[1].strip()
    return nomes


def nome_arquivo(cnae, nomes_cnae):
    """Monta um nome de arquivo seguro: '4721102 - Padaria e confeitaria....txt'."""
    descricao = nomes_cnae.get(cnae, "")
    if descricao:
        descricao = re.sub(r'[\\/:*?"<>|]', " ", descricao)
        descricao = re.sub(r"\s+", " ", descricao).strip()[:80]
        return f"{cnae} - {descricao}.txt"
    return f"{cnae}.txt"


def main():
    args = sys.argv[1:]
    somente_ativas = "--ativas" in args
    pasta_saida = "cnpjs_por_atividade"
    if "--saida" in args:
        pasta_saida = args[args.index("--saida") + 1]
    pastas = [a for a in args if not a.startswith("--") and a != pasta_saida]
    pasta = pastas[0] if pastas else os.path.join(os.path.dirname(os.path.abspath(__file__)), "dados")

    arquivos = sorted(glob.glob(os.path.join(pasta, "Estabelecimentos*.zip")))
    if not arquivos:
        raise SystemExit(f"ERRO: nenhum Estabelecimentos*.zip encontrado em {pasta}")

    nomes_cnae = carregar_cnaes(pasta)

    print(f"\nExtraindo CNPJs por atividade de {len(arquivos)} arquivo(s) ZIP")
    print(f"  Filtro : {'somente ATIVAS' if somente_ativas else 'todas as situações'}")
    print(f"  Saída  : {pasta_saida}\\")
    print(f"  CNAEs  : {'descrições carregadas do Cnaes.zip' if nomes_cnae else 'Cnaes.zip não encontrado — arquivos terão só o código'}\n")
    if len(arquivos) < 10:
        print(f"  [aviso] Você tem {len(arquivos)} de 10 arquivos — para o Brasil inteiro,")
        print(f"          baixe Estabelecimentos0.zip a Estabelecimentos9.zip.\n")

    os.makedirs(pasta_saida, exist_ok=True)
    # limpa resultados de execuções anteriores para não duplicar/misturar
    for antigo in glob.glob(os.path.join(pasta_saida, "*.txt")) + glob.glob(os.path.join(pasta_saida, "_resumo.csv")):
        os.remove(antigo)

    inicio = time.time()
    total = 0
    handles = {}    # cnae -> arquivo aberto
    contagem = {}   # cnae -> quantidade

    try:
        for arq in arquivos:
            print(f"  {os.path.basename(arq)}")
            with zipfile.ZipFile(arq) as zf:
                for nome in zf.namelist():
                    with zf.open(nome) as bruto:
                        texto = io.TextIOWrapper(bruto, encoding="latin-1", errors="replace", newline="")
                        for row in csv.reader(texto, delimiter=";", quotechar='"'):
                            if len(row) < 12:
                                continue
                            if somente_ativas and row[5] != "02":
                                continue
                            cnpj = row[0] + row[1] + row[2]
                            cnae = row[11].strip() or "sem_atividade"
                            if len(cnpj) != 14:
                                continue
                            f = handles.get(cnae)
                            if f is None:
                                caminho = os.path.join(pasta_saida, nome_arquivo(cnae, nomes_cnae))
                                f = open(caminho, "w", encoding="ascii", newline="\n")
                                handles[cnae] = f
                            f.write(cnpj + "\n")
                            contagem[cnae] = contagem.get(cnae, 0) + 1
                            total += 1
                            if total % 1_000_000 == 0:
                                print(f"\r    {total:,} CNPJs...".replace(",", "."), end="", flush=True)
            print(f"\r    {total:,} CNPJs até aqui".replace(",", "."))
    finally:
        for f in handles.values():
            f.close()

    # resumo com quantidades, da atividade mais comum para a menos comum
    resumo = os.path.join(pasta_saida, "_resumo.csv")
    with open(resumo, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["codigo_cnae", "atividade", "quantidade_cnpjs"])
        for cnae, qtd in sorted(contagem.items(), key=lambda x: x[1], reverse=True):
            w.writerow([cnae, nomes_cnae.get(cnae, ""), qtd])

    minutos = (time.time() - inicio) / 60
    print(f"\nConcluído em {minutos:.1f} min — {total:,} CNPJs em {len(contagem)} atividades".replace(",", "."))
    print(f"  Listas : {pasta_saida}\\")
    print(f"  Resumo : {resumo}")


if __name__ == "__main__":
    main()
