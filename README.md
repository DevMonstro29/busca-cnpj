# Busca CNPJ + Perfil da Empresa no Google

Sistema web para consultar listas de CNPJs e descobrir, para cada empresa:

- **Dados da Receita Federal**: razão social, nome fantasia, segmento (CNAE), cidade/UF, situação cadastral e telefone — via [BrasilAPI](https://brasilapi.com.br) com reserva na [minhareceita.org](https://minhareceita.org)
- **Perfil da Empresa no Google** (Google Business Profile): se existe, nome, endereço, avaliação e link do Maps — via Google Places API (New)

Inclui também um script para extrair CNPJs dos dados abertos da Receita Federal, separados por atividade (CNAE).

---

## 1. Instalação

Requisitos: Python 3.10+ instalado.

```powershell
pip install flask requests openpyxl
```

## 2. Como rodar

```powershell
python app.py
```

Acesse **http://localhost:5000** no navegador.

---

## 3. Usando o painel de consulta

### Passo 1 — Chave da API do Google (opcional)

- Cole sua chave da **Google Places API (New)** e clique em **Salvar** (fica gravada só no seu navegador)
- Para obter uma chave: [Google Cloud Console → Places API (New)](https://console.cloud.google.com/apis/library/places-backend.googleapis.com) — crie um projeto, habilite a *Places API (New)* e gere uma chave em *Credenciais*
- **Sem chave**, o sistema funciona normalmente, mas consulta apenas os dados da Receita Federal (não verifica o perfil no Google)

> **Custo:** o Google cobra ~US$ 32 por 1.000 buscas (há ~US$ 200/mês de crédito gratuito ≈ 6.000 buscas). Cada CNPJ consultado com chave = 1 busca. Para listas grandes, rode primeiro sem chave ou use recortes pequenos.

### Passo 2 — Lista de CNPJs

Duas formas de preencher:

1. **📂 Carregar arquivo** — aceita `.xlsx`, `.xlsm`, `.csv` e `.txt`. O sistema encontra os CNPJs automaticamente em qualquer lugar do arquivo (com ou sem pontuação) e:
   - Valida os dígitos verificadores (CNPJs inválidos são ignorados e avisados)
   - Corrige CNPJs que perderam zeros à esquerda no Excel (células numéricas)
2. **Colar direto** na caixa de texto, um CNPJ por linha (com ou sem pontuação)

Clique em **🚀 Iniciar Busca**. A barra mostra o progresso e dá para interromper com **⏹ Parar** a qualquer momento (os resultados já consultados são mantidos).

> A consulta respeita o limite da BrasilAPI (~2 por segundo). Uma lista de 100 CNPJs leva ~1 minuto.

### Passo 3 — Resultados

Cada linha mostra os dados da Receita + a coluna **Perfil Google**:

| Selo | Significado |
|------|-------------|
| 🟢 **Sim** | Perfil encontrado com alta confiança (nome parecido + sinais como telefone/CEP conferindo) |
| 🟡 **Possível** | Encontrou algo parecido, mas vale conferir manualmente (passe o mouse no selo para ver o motivo) |
| 🔴 **Não** | Nenhum perfil correspondente no Google |

Como a correspondência é calculada (passe o mouse sobre o selo para ver os detalhes):

- Compara o nome do perfil com o nome fantasia **e** a razão social, ignorando acentos, pontuação e sufixos (LTDA, ME, EPP, EIRELI, S/A...)
- **Telefone igual** ao da Receita: forte indício (+confiança)
- **CEP ou rua conferindo** com o endereço da Receita: +confiança
- **Cidade divergente**: -confiança (evita confundir com homônimo de outra cidade)
- Perfil marcado como **fechado permanentemente** é sinalizado

**⬇ Exportar CSV (Excel)** baixa tudo (incluindo detalhes da correspondência, endereço do Google e link do Maps) em CSV pronto para abrir no Excel.

### Busca por nome fantasia

No card **"Ou: busque pelo nome fantasia"**, digite o nome da empresa (e cidade, opcional) e clique em **Buscar no Google**.

- Exige a chave da API do Google
- Retorna os perfis encontrados com % de semelhança, endereço, telefone, avaliação, site e Maps
- **Não retorna o CNPJ** — a Receita Federal não oferece busca pública por nome

---

## 4. Extraindo CNPJs dos dados abertos da Receita (`extrair_cnpjs.py`)

Gera listas de CNPJs **separadas por atividade (CNAE)** a partir dos arquivos oficiais da Receita Federal, lendo os `.zip` diretamente — **não precisa extrair nada**.

### Baixando os dados (gratuito)

Use o script `baixar_dados.py` — baixa direto do compartilhamento público da Receita Federal para a pasta `dados\`, pulando o que já existe e retomando downloads interrompidos:

```powershell
python baixar_dados.py                 # baixa Estabelecimentos0..9 + Cnaes (o que faltar)
python baixar_dados.py --mes 2026-05   # escolhe outro mês disponível
python baixar_dados.py 0 1 2           # baixa só Estabelecimentos0,1,2 (+ Cnaes)
python baixar_dados.py --cnaes         # só o Cnaes.zip
```

| Arquivo | Conteúdo |
|---------|----------|
| `Estabelecimentos0.zip` ... `Estabelecimentos9.zip` | CNPJ completo + nome fantasia + atividade (cada um tem ~10% do Brasil; o `0` é maior, ~2 GB) |
| `Cnaes.zip` | Nomes das atividades (pequeno, recomendado) |

> Os 10 arquivos somam ~5 GB. Para o Brasil inteiro, baixe todos. Para testar, 1 ou 2 já dão uma amostra.

### Rodando

```powershell
python extrair_cnpjs.py --filtrar --ativas    # SÓ as categorias de interesse, empresas ATIVAS (recomendado)
python extrair_cnpjs.py --ativas              # todas as atividades, só ATIVAS
python extrair_cnpjs.py                       # tudo, todas as situações cadastrais
python extrair_cnpjs.py C:\outra\pasta        # ZIPs em outra pasta
python extrair_cnpjs.py --saida minha_pasta   # muda a pasta de saída
```

#### Categorias de interesse (`--filtrar`)

Com `--filtrar`, o script extrai **apenas** os CNAEs definidos em `CNAES_ALVO` (topo do `extrair_cnpjs.py`):

| CNAE | Atividade | Categoria |
|------|-----------|-----------|
| `4773300` | Comércio varejista de artigos médicos e ortopédicos | Mobilidade/acessibilidade + Equip. médico |
| `4645102` | Comércio atacadista de próteses e artigos de ortopedia | Mobilidade/acessibilidade |
| `4645101` | Comércio atacadista de instrumentos/materiais médico-hospitalares | Equip. médico |
| `4664800` | Comércio atacadista de máquinas/equip. médico-hospitalar | Equip. médico |
| `4618402` | Representantes de materiais médico-hospitalares | Equip. médico |
| `4756300` | Comércio varejista de instrumentos musicais e acessórios | Instrumentos musicais |
| `4763605` | Comércio varejista de embarcações e veículos recreativos | Náutica |
| `4614100` | Representantes de máquinas, equipamentos, embarcações e aeronaves | Náutica |

Para incluir/remover CNAEs, edite o dicionário `CNAES_ALVO`.

### Saída (pasta `cnpjs_por_atividade\`)

- **Um `.txt` por atividade**, um CNPJ por linha, ex:
  `4753900 - Comércio varejista especializado de eletrodomésticos e equipamentos de áudio e vídeo.txt`
- **`_resumo.csv`** — código do CNAE, nome da atividade e quantidade de CNPJs, da atividade mais comum para a menos comum (abre no Excel)

Qualquer um desses `.txt` pode ser carregado direto no painel (botão 📂) para consultar aquele segmento.

> Com os 10 arquivos de Estabelecimentos, a extração do Brasil inteiro (~22 milhões de empresas ativas) leva de 3 a 5 minutos. A pasta de saída é limpa a cada execução para não duplicar.

### Dica: filtrando um segmento

Use o `_resumo.csv` para achar o CNAE certo. Exemplo — lojas físicas de eletrodomésticos:

- `4753900` — Comércio varejista de eletrodomésticos e áudio/vídeo (lojas)
- `4757100` — Comércio varejista de peças para eletroeletrônicos domésticos

Atividades de **comércio varejista** pressupõem ponto de venda; para confirmar a loja física, rode a lista no painel com a chave do Google e filtre os resultados **"Sim"** com *CEP/rua confere*.

---

## 5. Estrutura do projeto

```
busca-cnpj/
├── app.py                  # servidor Flask (rotas, consulta Receita, match Google, filtro de categoria)
├── baixar_dados.py         # baixa os ZIPs da Receita (gratuito, com retomada)
├── extrair_cnpjs.py        # extrai CNPJs dos ZIPs da Receita, separados por CNAE (--filtrar)
├── templates/
│   └── index.html          # página do painel
├── static/
│   ├── app.js              # lógica do painel (upload, busca, tabela, exportação)
│   └── style.css           # visual
└── dados/                  # ZIPs da Receita (não versionado — arquivos grandes)
```

### Filtro por categoria no Google + "perfis sem site"

No `app.py`, o dicionário `CATEGORIAS_PERMITIDAS` define quais categorias do Google são aceitas
(mobilidade/scooters, instrumentos musicais, equipamento médico, náutica). Perfis fora dessas
categorias são marcados como **"Fora das categorias permitidas"**.

O objetivo do fluxo é achar **empresas que têm perfil no Google mas NÃO têm site**:

- A coluna **Site** mostra um selo vermelho **"SEM SITE"** quando o perfil existe sem `websiteUri`
- O resumo conta quantos estão **"COM PERFIL E SEM SITE"**
- O checkbox **"Só perfis SEM site"** filtra a tabela; o CSV exportado respeita esse filtro

## 6. Limites e observações

- **BrasilAPI**: gratuita, ~2 consultas/segundo (o painel já respeita com pausa de 400ms). Se falhar, o sistema tenta a minhareceita.org automaticamente
- **Google Places**: pago por consulta; configure alertas de orçamento no Google Cloud
- A chave do Google fica salva **apenas no navegador** (localStorage), nunca em arquivo ou servidor
- Os dados abertos da Receita são atualizados mensalmente — baixe os ZIPs novos e rode a extração de novo quando quiser atualizar
