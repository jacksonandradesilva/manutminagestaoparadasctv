# Gestão de Paradas da Manutenção

Aplicação web para registrar, acompanhar e analisar paradas de manutenção em turnos, com painel de acompanhamento, histórico, relatórios por turno, dashboard e gestão de acessos por usuário.

## Visão geral

Este projeto foi desenvolvido em React + Vite e permite:

- registrar ocorrências de parada de manutenção;
- consultar histórico por atendimento, turno e painel;
- analisar totais por turno, turma e equipamento/painel;
- visualizar indicadores em dashboard;
- usar uma funcionalidade de IA simples para responder perguntas sobre os dados;
- controlar acesso por autenticação com Supabase e liberação de usuários por administrador.

## Tecnologias

- React 18
- Vite
- React Router DOM
- Supabase (autenticação e persistência de dados)
- LocalStorage como fallback quando o Supabase não está configurado

## Estrutura do projeto

```bash
.
├── src/
│   ├── App.jsx
│   ├── main.jsx
│   ├── store.js
│   └── utils.js
├── api/
│   └── alerta-parada-3h.js
├── data/
│   └── store.json
├── supabase/
│   └── schema.sql
├── public/
├── img/
├── app-api.js
├── DATABASE_SETUP.md
├── package.json
├── vite.config.js
├── vercel.json
├── index.html
├── historico.html
├── historico_opcoes.html
├── relatorio.html
└── README.md
```

## Requisitos

Antes de iniciar, você precisa ter instalado:

- Node.js 18+
- npm

## Instalação

1. Clone o projeto:

```bash
git clone <url-do-repositorio>
cd manutminagestaoparadasv12
```

2. Instale as dependências:

```bash
npm install
```

## Executando localmente

```bash
npm run dev
```

A aplicação será iniciada em modo de desenvolvimento e pode ser acessada pela URL mostrada no terminal, normalmente:

```bash
http://localhost:5173
```

## Build de produção

```bash
npm run build
```

Depois, você pode testar a versão final com:

```bash
npm run preview
```

## Configuração do Supabase

A aplicação pode funcionar em dois modos:

1. com Supabase configurado;
2. em modo local via localStorage.

### Variáveis de ambiente

Crie um arquivo `.env.local` na raiz do projeto com:

```bash
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SUA_CHAVE_ANON
```

> Importante: use a URL do projeto Supabase e a chave anon pública, não a service_role.

### Banco de dados

O script SQL de estrutura está em:

- `supabase/schema.sql`

E a documentação detalhada de configuração está em:

- `DATABASE_SETUP.md`

### Usuários e permissões

- qualquer novo cadastro entra como pendente;
- um usuário administrador libera acesso;
- rotas e páginas podem ser habilitadas por perfil;
- o sistema registra auditoria de ações no painel administrativo.

## Funcionalidades principais

### Dashboard principal

Exibe visão geral de paradas e indicadores importantes.

### Gestão de paradas

Permite consultar e controlar o histórico de ocorrências registradas.

### Relatório por turno

Agrupa dados por turno e permite análise por intervalo de operação.

### Histórico por opção

Acompanha registros de acordo com opções e categorias relacionadas às paradas.

### Agente IA

Há uma área que interpreta perguntas simples como:

- qual painel teve mais paradas;
- qual turno acumulou mais tempo;
- qual turma teve mais ocorrências;
- quanto tempo total foi registrado.

## Deploy

O projeto está preparado para deploy em Vercel, com variáveis de ambiente configuradas no painel do Vercel.

Configure as mesmas variáveis:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Depois faça um novo deploy ou redeploy para que as variáveis sejam aplicadas.

## Observações importantes

- sem as variáveis do Supabase, a aplicação usa apenas localStorage;
- a aplicação exige autenticação quando o Supabase está habilitado;
- arquivos HTML antigos na raiz (`historico.html`, `historico_opcoes.html`, `relatorio.html`) não fazem parte do build principal do React;
- para alterar o site publicado, edite os arquivos em `src/` e rode `npm run build`.

## Scripts disponíveis

```bash
npm run dev     # desenvolvimento
npm run build   # build de produção
npm run preview # preview do build
```

## Licença

Este projeto não informa uma licença específica no repositório. Verifique com o responsável do projeto antes de reutilizar em produção ou distribuir publicamente.

## Dúvidas ou manutenção

Para continuar evoluindo o projeto, os pontos principais de revisão são:

- `src/App.jsx` para telas e fluxo da aplicação;
- `src/store.js` para autenticação, persistência e regras de acesso;
- `supabase/schema.sql` para estrutura do banco;
- `DATABASE_SETUP.md` para configuração do ambiente e do Supabase.
