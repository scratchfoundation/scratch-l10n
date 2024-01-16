# Changelog

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [3.18.0](https://github.com/scratchfoundation/scratch-l10n/compare/v3.17.0...v3.18.0) (2024-01-16)


### Features

* realign version numbers ([c4f9f06](https://github.com/scratchfoundation/scratch-l10n/commit/c4f9f06744c13c97032986360faffba953ff8538))

# 1.0.0 (2024-01-16)


### Bug Fixes

* add missing stdout ([113c0c0](https://github.com/scratchfoundation/scratch-l10n/commit/113c0c095e1e7a4a6f8a678d11d67f35221b23ca))
* **deps:** update babel monorepo ([0ec47c2](https://github.com/scratchfoundation/scratch-l10n/commit/0ec47c2d6f35b35b38f9267ae14f4821886a20c5))
* **deps:** update babel monorepo to v7.23.7 ([172691f](https://github.com/scratchfoundation/scratch-l10n/commit/172691f13359cb093fadd5ebeaa8e8cdc10f1078))
* **deps:** update dependency @transifex/api to v4.3.0 ([8787503](https://github.com/scratchfoundation/scratch-l10n/commit/8787503122f934d554ce548ed97e3c6271906056))
* fetch languages and correctly get language code in txAvailableLanguages ([a3eed89](https://github.com/scratchfoundation/scratch-l10n/commit/a3eed8987b5cb4b840dff3a5b463f9f8f76b61e6))
* fix some errors with validation and error output ([bc151d5](https://github.com/scratchfoundation/scratch-l10n/commit/bc151d5ef8ed6b356e6e33dbd89e081a815e42aa))
* remove unnecessary if statement ([34fcab3](https://github.com/scratchfoundation/scratch-l10n/commit/34fcab3ce0247834d168bda08492a71367924e8c))
* **scripts:** add retries, correct formatting for editor ([137b6e3](https://github.com/scratchfoundation/scratch-l10n/commit/137b6e3d09e6d383213f22acc110aef217871d42))
* use correct name for Filipino ([2634e78](https://github.com/scratchfoundation/scratch-l10n/commit/2634e788064bd616c9eb6c8c999dc226f3d8199c))
* use correct return type for async functions ([beda44e](https://github.com/scratchfoundation/scratch-l10n/commit/beda44ed7b9062342286552c27436e0ae9b87bf1))
* use es6 in eslint to avoid disabling linting on some lines ([b67ea68](https://github.com/scratchfoundation/scratch-l10n/commit/b67ea684e74289b424da9a3b7114dd395fca2dff))
* use stdout instead of console ([f298a58](https://github.com/scratchfoundation/scratch-l10n/commit/f298a58aeba7718fb13c636dcff3e6ac6bc979ce))
* use tidier import for transifex imports ([d6f1224](https://github.com/scratchfoundation/scratch-l10n/commit/d6f1224931e5c71c3b8b6a8ee7712f28d75efe0c))


* Add scratch-paint ([0cb13cb](https://github.com/scratchfoundation/scratch-l10n/commit/0cb13cbaee11c9ba32269730d92224b3caeedba3))


### Features

* add asturian language ([01e29ea](https://github.com/scratchfoundation/scratch-l10n/commit/01e29ea229d1401f01b5430836003a011dcba64a))
* add esperanto language ([af35fe0](https://github.com/scratchfoundation/scratch-l10n/commit/af35fe0dbe51b1d3ef1d916bab5b53d047dc76e0))
* add filipino translations ([ccae0fc](https://github.com/scratchfoundation/scratch-l10n/commit/ccae0fc838d2e1b0a2642bc356bea799c423017d))
* add hausa language ([b6f145b](https://github.com/scratchfoundation/scratch-l10n/commit/b6f145bb94c1b0def0e8ae965565bab12befc0ea))
* add hindi ([74f5560](https://github.com/scratchfoundation/scratch-l10n/commit/74f556088822f4c64071623c0c9a8142361d05ef))
* add occitan language ([8b1d255](https://github.com/scratchfoundation/scratch-l10n/commit/8b1d25597fcc4700e0420e0f2ea250cce2691edc))
* mark automated Transifex updates as fixes ([94c3353](https://github.com/scratchfoundation/scratch-l10n/commit/94c3353f541403e8c4ecfb635684fc639562e3d0))
* migrate help utils to v3 api ([db7a2a4](https://github.com/scratchfoundation/scratch-l10n/commit/db7a2a4ca0e5fb55e097752a66087932a64c492e))
* migrate push help script ([2907601](https://github.com/scratchfoundation/scratch-l10n/commit/2907601077cfa890984f905e0c591be42d3c0280))


### BREAKING CHANGES

* - bumped major version to 2.

Restructured to support multiple components. Package default is just localeData for currently supported locales including the name for each language.

messages for each component are exported as separate files in locales. Clients of l10n will need to import messages for each of the compents used and combine them.
