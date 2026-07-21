# Acts — Gestão de Igreja e Equipes de Ministério

> Plataforma **open-source e gratuita** para gestão de igreja: escalas de culto,
> equipe de mídia, voluntários, patrimônio e ministérios — feita para funcionar
> no celular de quem serve.

**Acts** é um CRM de igreja / church management system em português, pensado para
o dia a dia real de uma equipe de ministério: quem serve, quando serve, com o
quê, e como cada voluntário evolui. Nasceu na **gestão da equipe de mídia** e
cresce para a igreja inteira — cada ministério como uma ramificação.

**Palavras-chave:** gestão de igreja · CRM igreja · church management · escala de
culto · equipe de mídia · organização de voluntários · ministério · louvor ·
escala de voluntários · gestão de equipe de igreja · software para igreja ·
church CRM · igreja evangélica · sistema de escalas · gestão de mídia da igreja ·
PWA · Next.js · Supabase · multi-tenant.

---

## O que o Acts resolve

Igrejas coordenam dezenas de voluntários no WhatsApp e em planilhas — e o
resultado é gente que esquece a escala, líderes sem visão de quem confirmou, e os
mesmos poucos sempre sobrecarregados. O Acts organiza isso num só lugar,
**mobile-first**, com foco em fazer o voluntário **aparecer**.

## Funcionalidades

- **Escalas & eventos** — monte a escala do culto, escale pessoas por função,
  vincule equipamentos, e acompanhe quem **confirmou / falta confirmar / pediu
  troca** num olhar.
- **Confirmação de presença** em um toque — pela Home ou adicionando a escala ao
  **calendário do celular** (`.ics`).
- **Escalação assistida** — ao escalar, o líder vê a **carga do mês** de cada
  pessoa, se está **indisponível** na data, suas **aptidões** e seus
  **interesses** — decisão informada, sem sobrecarregar sempre os mesmos.
- **Indisponibilidade** — o voluntário avisa quando não pode servir, antes da
  escala existir.
- **Aptidões, interesses e treinamento** — o sistema cruza *quem quer* servir numa
  área com *quem já é apto*, gerando a fila de **"quem quer crescer"**.
- **Patrimônio / equipamentos** — inventário, histórico de uso, manutenções e
  chamados.
- **Pessoas & ministérios** — perfis, papéis, aptidões e departamentos.
- **Avaliações pós-culto** — feedback estruturado por critérios.
- **Multi-igreja (multi-tenant)** — isolamento por igreja via Row Level Security.
- **PWA** — instala na tela inicial, funciona como app no celular.

## Papéis

Dois níveis, como uma igreja de verdade:

- **Igreja:** Administrador · Coordenador · Membro
- **Ministério:** Gerente · Líder · Instrutor · Voluntário
- **Plataforma:** Super-admin (opera em todas as igrejas)

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js (App Router, React Server Components), TypeScript, Tailwind, Base UI |
| Backend | Supabase (Postgres + **RLS** + Auth + Storage) |
| Deploy | Cloudflare Workers via OpenNext |
| App | PWA (instalável, mobile-first) |

Segurança de dados por **Row Level Security** no Postgres: cada igreja só
enxerga os próprios dados, garantido no banco — não só na aplicação. Suíte de
testes de RLS cobre o isolamento entre igrejas.

## Rodando localmente

Pré-requisitos: Node 20+, Docker (para o Supabase local), Supabase CLI.

```bash
npm install
cp .env.example .env.local      # preencha URL e ANON KEY do Supabase
npx supabase start              # sobe o Postgres/Auth/Storage local
npx supabase db reset           # aplica as migrations
npm run dev                     # http://localhost:3000
npm test                        # testes de RLS + unitários (precisa do Supabase local)
```

As migrations ficam em `supabase/migrations/`. **Antes de usar**, ajuste a
allowlist de super-admins em `00000000000006_super_admin.sql` (há e-mails de
exemplo — troque pelos seus).

## Filosofia do projeto

Acts é **free para qualquer igreja**. A ideia é que quem puder contribuir ajude a
sustentar a estrutura — e, num modelo solidário, mantenha as igrejas menores
sempre gratuitas. É um **agregador**: centraliza a gestão e pretende **conversar**
com as ferramentas que a igreja já usa (como o Holyrics), sem refazê-las.

## Contribuindo

Contribuições são bem-vindas — issues, ideias e PRs. O sistema é desenhado para
crescer por módulos (cada ministério é uma ramificação).

## Licença

MIT — veja [LICENSE](LICENSE).
