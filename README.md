# svt20-content

Static content repository for [SVT20](https://svt20.com) — educational platform for Moroccan BAC students (Sciences de la Vie et de la Terre).

**Live CDN:** https://medmor.github.io/svt20-content/

## Structure

```
svt20-content/
├── chapters/          # Chapter HTML content (level/unit/chapter.html)
├── exercises/         # Chapter exercises
├── exams/            # Exam exercises (year/branch/session/)
├── images/
│   ├── figures/       # Chapter figures (level/unit/chapter/...)
│   └── exams/        # Exam images (sm/sp/svt/yearSession/)
└── index.json        # Full content index
```

**Content levels:** TC (Tronc Commun), 1 Bac, 2 Bac  
**Branches:** SM (Sciences Math), SP (Sciences Physiques), SVT (Sciences Vie Terre)

## Image CDN URLs

- **Chapter figures:** `https://medmor.github.io/svt20-content/images/figures/{level}/{unit}/{chapter}/...`
- **Exam images:** `https://medmor.github.io/svt20-content/images/exams/{branch}/{yearSession}/...`

## Exam HTML Files

Exam exercises are plain HTML files rendered via `dangerouslySetInnerHTML`. All image URLs must be **absolute CDN URLs** (not relative paths).

Pattern: `https://medmor.github.io/svt20-content/images/exams/{branch}/{yearSession}/image*.jpg`

## TODO

### Chapters without `.fiche` files (22 chapters)

These chapters exist in the DB but have no `.fiche.html` summary file:

#### TC (1 chapter)
- [ ] Unité 1 (Lettres) — `eau-potable-et-cycle-deau`
- [ ] Unité 2 — `la-reproduction-sexue-chez-les-plates-fleurs-gymnosperme-`
- [ ] Unité 2 — `les-cycles-de-vie-et-la-classification-des-plantes-`

#### 1 Bac (10 chapters)
- [ ] Unité 2 — `les-changes-gazeux-chlorophylliens-et-la-production-de-la-matire-organique`
- [ ] Unité 2 — `captation-de-lnergie-lumineuse-et-ractions-de-la-photosynthse`
- [ ] Unité 3 — `les-communications-hormonales-rgulation-de-la-glycmie`
- [ ] Unité 3 — `la-communication-nerveuse`
- [ ] Unité 4 — `rgulation-de-la-fonction-reproductrice-chez-lhomme`
- [ ] Unité 1 (Lettres) — `fonction-reproductrice-chez-lhomme`
- [ ] Unité 1 (Lettres) — `fonction-reproductrice-chez-la-femme-`
- [ ] Unité 1 (Lettres) — `de-la-fcondation-la-naissance`
- [ ] Unité 2 (Lettres) — `les-rles-de-la-miose-et-de-la-fcondation-dans-la-diversit-gntique`

#### 2 Bac (7 chapters)
- [ ] Unité 2 — `le-gnie-gntique`
- [ ] Unité 3 — `la-gntique-humaine`
- [ ] Unité 4 — `gntique-des-populations`
- [ ] Unité 5 — `la-discrimination-entre-le-soi-et-le-non-soi`
- [ ] Unité 5 — `la-rponse-immunitaire-non-spcifique`
- [ ] Unité 5 — `la-rponse-immunitaire-spcifique`
- [ ] Unité 5 — `drgement-du-systme-immunitaire`

### Chapters without figures (15 chapters)

These chapters have `image = NULL` in `svt.db` and show the logo placeholder on unit pages:

#### TC (3 chapters)
- [ ] `la-reproduction-sexue-chez-les-plates-fleurs-gymnosperme-` (Unité 2)
- [ ] `la-reproduction-sexue-chez-les-plantes-sans-fleurs-` (Unité 2)
- [ ] `les-cycles-de-vie-et-la-classification-des-plantes-` (Unité 2)

#### 2 Bac (12 chapters)
- [ ] `rgulation-de-la-fonction-reproductrice-chez-lhomme` (Unité 4)
- [ ] `le-gnie-gntique` (Unité 2)
- [ ] `la-gntique-humaine` (Unité 3)
- [ ] `gntique-des-populations` (Unité 4)
- [ ] `la-discrimination-entre-le-soi-et-le-non-soi` (Unité 5)
- [ ] `la-rponse-immunitaire-non-spcifique` (Unité 5)
- [ ] `la-rponse-immunitaire-spcifique` (Unité 5)
- [ ] `drgement-du-systme-immunitaire` (Unité 5)
- [ ] `moyens-daide-du-systme-immunitaire` (Unité 5)
- [ ] `la-formation-des-chanes-de-montagnes` (Unité 6)
- [ ] `le-mtamorphisme-et-sa-relation-avec-la-tectonique-des-plaques` (Unité 6)
- [ ] `la-granitisation-et-sa-relation-avec-le-mtamorphisme` (Unité 6)

> **Note:** All 15 chapters without figures also lack `.fiche` files. Generating figures for these would cover both gaps at once.
