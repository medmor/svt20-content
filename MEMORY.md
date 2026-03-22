# svt20-content — Project Memory

## Content Structure

### Chapters
- Location: `chapters/<level>/<unit>/<chapter-slug>.html`
- Frontmatter: `id`, `slug`, `title`, `course`, `level`, `levelName`, `unit`, `unitName`, `type: chapter`
- Content: HTML with H2/H3/H4 headings

### Fiches (Lesson Plan Summaries)
- Location: `chapters/<level>/<unit>/<chapter-slug>.fiche.html`

### Exercises
- Index: `exams/<level>/<unit>/<exam-slug>/index.json`
- Individual exercises: `exams/<level>/<unit>/<exam-slug>/<exercise-slug>.html`

### Figures
- Index: `chapters/<level>/<unit>/figures.json`
- Images served from: `https://medmor.github.io/svt20-content/images/...`

## Fiche Format — How to Create / Improve a Fiche from a Chapter

A `.fiche.html` is a teacher lesson-plan summary. It has two tables:
1. **Header table** — metadata (level, unit, chapter title, prérequis, objectifs généraux)
2. **Plan table** — one row per lesson item with: Plan du cours | Objectifs | Activités | Supports

### Row Splitting Rule
- **Every numbered item (1, 2, 3...) gets its own row**
- Sub-items (a, b, c) stay **nested inside** their parent row
- H2 headings = parent rows; H3 headings that start with a number = standalone rows

### Columns per Row
1. **Plan du cours** — heading text + nested sub-items (indented `<ul>`)
2. **Objectifs** — one specific, targeted objective for THIS item only (not generic)
3. **Activités** — Prof + Élèves activities specific to this item
4. **Supports** — always: Tableau, Figures, Manuel scolaire

### How to Determine Objectives & Activities
From each principle/concept in the chapter, derive:
- A defining activity (**Définir / Identifier**)
- An applying activity (**Appliquer / Utiliser / Classer / Déterminer**)
- An exception or special case when relevant

### Reference File
`chapters/1-bac/unit-1/ralisation-de-la-carte-palogographique-dune-rgion.fiche.html` — the best-formatted example

## Exam Exercise HTML Structure
Exercises are split at `<h2>Correction</h2>`:
- Enoncé: everything before the Correction heading
- Correction: the correction content

The split is done by finding the "Correction" text → going back to find the `<h2` tag → splitting after its closing `</h2>`.

## Key Scripts
- `scripts/remove-data-type-divs.mjs` — removes old wrapper divs from exam HTML
- `scripts/migrate-figures-from-supabase.cjs` — syncs figures from Supabase
- `scripts/rename-exercise-folders.cjs` — renames exercise folders to full slugs
- `scripts/fix-slugs.js` — updates SQLite slugs from index.json

## Git Branches
- `mdx-migration` — main development branch for the static content migration
