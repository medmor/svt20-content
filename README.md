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

### Chapters without figures (15 chapters)

These chapters have `image = NULL` in `svt.db` and show the logo placeholder on unit pages.

All chapters now have `.fiche.html` summary files.

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
