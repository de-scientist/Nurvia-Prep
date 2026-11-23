# NURVIA Prep

**A nursing education and examination-preparation platform.**

NURVIA Prep is a web application for learners preparing for nursing examinations and developing their clinical knowledge. The application brings together nursing exam pathways, learning resources, assessment experiences, and learner-facing tools in one platform.

Its application structure includes dedicated experiences for NCLEX-RN, NCLEX-PN, and LPN nursing, alongside broader examination-preparation pathways and supporting platform features.

## Platform overview

The repository contains the following application areas:

- **Nursing examination pathways** — dedicated experiences for NCLEX-RN, NCLEX-PN, and LPN nursing, as well as other examination-preparation routes.
- **Learner experiences** — dashboards, learning pages, examination sessions, study resources, and related learner functionality.
- **Assessment and examination** — examination pages, question-related experiences, exam sessions, and supporting workflows.
- **Study and learning resources** — study guides, notes, resources, and related learning experiences.
- **Administration** — administrative pages for areas such as learners, examinations, questions, analytics, reviews, plans, and settings.
- **Platform services** — application API routes, authentication-related pages, and middleware.

The available functionality is determined by the implementation and configuration in the current repository. Historical reports in the documentation describe work completed or investigated at particular points in the project's development; they should not automatically be interpreted as proof of current production status.

## Technology

The application uses the following technologies and libraries:

- **Next.js 15** — application framework and routing.
- **React 18** — component-based user interface.
- **TypeScript 5** — application development and type checking.
- **Tailwind CSS 4** — styling.
- **Axios** — HTTP communication.
- **NextAuth** — authentication integration.
- **ApexCharts / Recharts** — data visualization.
- **Framer Motion** — interface animation.
- **Lucide React** — interface icons.
- **Lexical and Tiptap** — rich-text editing capabilities.

The exact installed versions are defined in `package.json` and the lockfile.

## Getting started

### Prerequisites

Install a compatible Node.js runtime and npm.

### 1. Clone the repository

```bash
git clone <repository-url>
cd Nurvia-Prep
```

Replace `<repository-url>` with the repository's actual Git URL.

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Review the environment templates:

- `.env.example`
- `.env.local.example`

Configure the variables required by the integrations and application features you intend to run. The templates identify the primary application and backend configuration variables; source code may reference additional settings for optional integrations.

For local development, place your local configuration in `.env.local`. Use valid environment-specific values, keep credentials and application keys private, and never commit populated secret files.

The application includes configuration for selecting an active backend and connecting to backend services. Ensure the selected backend is reachable and correctly configured before relying on features that require it.

### 4. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Available scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the development server using Turbopack. |
| `npm run build` | Create a production build. |
| `npm run start` | Start the production server after a successful build. |
| `npm run lint` | Run the repository's configured Next.js lint script. |

The commands above reflect the scripts currently declared in `package.json`. No dedicated test script is declared there; consult the project tooling and documentation for applicable verification procedures.

## Repository structure

```text
Nurvia-Prep/
├── audit_reports/       # Preserved audit and implementation artifacts
├── docs/                # Project documentation and engineering records
├── public/              # Public static assets
├── src/
│   ├── app/             # Next.js routes, pages, layouts, and API routes
│   ├── assets/          # Application assets
│   ├── components/      # Reusable interface components
│   ├── lib/             # Shared libraries and application utilities
│   ├── styles/          # Application styles
│   └── middleware.ts    # Application middleware
├── tests/               # Test-related files
├── tools/               # Project tooling
├── package.json
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── README.md
```

Some directories contain additional nested structures and specialized functionality.

## Documentation

The `docs/` directory is the primary home for organized project documentation.

| Location | Contents |
|---|---|
| [`docs/architecture/`](docs/architecture/) | Architecture proposals, persistence planning, shared systems, and Qlex/NURVIA parity records. |
| [`docs/audits/`](docs/audits/) | Technical audits, forensic investigations, and functionality-preservation reviews. |
| [`docs/development/`](docs/development/) | Development guidance and Git integration procedures. |
| [`docs/nurvia-ui-transformation/`](docs/nurvia-ui-transformation/) | UI inventories, baseline findings, and design-system documentation. |
| [`docs/project/`](docs/project/) | Project inventories and related reference material. |
| [`docs/replication/`](docs/replication/) | Replication, dependency, configuration, and reconciliation records. |
| [`docs/reports/`](docs/reports/) | Engineering, implementation, remediation, frontend, study-library, and release reports. |
| [`docs/ui-alignment/`](docs/ui-alignment/) | UI alignment inventories, registers, and verification reports. |

### Useful starting points

- [NURVIA Design System](docs/nurvia-ui-transformation/NURVIA_DESIGN_SYSTEM.md)
- [Application UI Inventory](docs/nurvia-ui-transformation/APPLICATION_UI_INVENTORY.md)
- [Architecture documentation](docs/architecture/)
- [Technical audits](docs/audits/)
- [Feature inventory](docs/project/inventory/feature_inventory.md)
- [Development and Git integration](docs/development/git-integration/)
- [Engineering and implementation reports](docs/reports/)

The separate `audit_reports/` directory is retained for structured audit evidence, investigation artifacts, and implementation records. Its contents are intentionally kept distinct from the organized project documentation.

## Development principles

When contributing to NURVIA Prep:

1. Inspect the existing implementation before changing established functionality.
2. Preserve working learner and administrative workflows.
3. Keep RN and PN/LPN pathway behavior distinct wherever the product requires it.
4. Validate API contracts and backend dependencies before changing integration behavior.
5. Prefer maintainable, reusable components and consistent interface patterns.
6. Document significant architectural decisions, audits, and implementation outcomes.
7. Verify changes with the relevant build, tests, and focused regression checks.

## Project status

This repository is an actively maintained application codebase with supporting engineering documentation and historical audit records.

For the authoritative state of a feature, inspect its current implementation, configuration, relevant tests, and the latest applicable project records. A report describing a planned or completed change is not, by itself, confirmation that the behavior remains present or operational.

---

**NURVIA Prep** — supporting the journey from learning to nursing examination readiness.