# Svelte library

Everything you need to build a Svelte library, powered by [`sv`](https://npmjs.com/package/sv).

Read more about creating a library [in the docs](https://svelte.dev/docs/kit/packaging).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```sh
# create a new project in the current directory
npx sv create

# create a new project in my-app
npx sv create my-app
```

To recreate this project with the same configuration:

```sh
# recreate this project
npx sv create --template library --types ts --add tailwindcss="plugins:typography,forms" mcp="ide:claude-code,vscode+setup:local" prettier vitest="usages:unit,component" --install npm ./
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

Everything inside `src/lib` is part of your library, everything inside `src/routes` can be used as a showcase or preview app.

## Translations

The apps are translated with [Paraglide](https://paraglidejs.com). English is the base language; Arabic is the first translation, written by a model and to be reviewed by a native speaker.

- The Arabic word for each main term is in `messages/arabic-terms.md`. Use those words in every Arabic message, and review that list before the messages.
- The messages are in `messages/en.json` and `messages/ar.json`. Add each new message to both files, with the same key. Keys for one app start with the app's name, for example `conformator_nav_home`.
- `npm run i18n` compiles them into `src/lib/paraglide` (generated, not committed). `npm run prepare` runs it too, so `npm install` and the Dockerfiles compile them. After changing a message, run `npm run i18n` again.
- In a component, `import { m } from '$shared/i18n'` (or `'@obp/shared/i18n'` in an app) and write `{m.conformator_nav_home()}`.
- An app that offers a language switch adds `i18nHandle` from `@obp/shared/server/i18n` to its handle sequence, puts `lang="%paraglide.lang%" dir="%paraglide.dir%"` on `<html>` in `app.html`, and shows `<LanguageSwitch />`. The language is the visitor's choice (a cookie), else their browser's language, else English. Apps without the handle stay in English.
- Numbers and dates: use `formatNumber` and `formatDate` from `$shared/i18n`, so they follow the page's language and the installation's `ARABIC_DIGITS` (`western`, the default, or `arabic-indic`). An app with a language switch also puts `data-arabic-digits="%arabic.digits%"` on `<html>`. Codes such as account numbers, versions and IDs are not numbers: show them as they are.
- Arabic pages are right to left. Use start/end classes (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`, `text-start`, `border-s`) rather than left/right ones (`ml-`, `pl-`, `left-`, `text-left`, `border-l`), and the same in CSS (`margin-inline-start`, `text-align: start`), so layouts mirror. An arrow that points along the text gets `rtl:rotate-180`. Code (`code`, `pre`) stays left to right on an Arabic page.
- Bold words and links inside a sentence: write them as markup in the message (`{#strong}…{/strong}`, `{#name}…{/name}`) and show it with `<RichMessage parts={m.key.parts()} links={{ name: url }} />`. Never put HTML in a message.
- An app's error page: `src/routes/+error.svelte` shows `<ErrorPage />` from `@obp/shared/components`.
- Opey answers in the page's language: the chat sends the page's language with each message as `page_language`.

## Building

To build your library:

```sh
npm pack
```

To create a production version of your showcase app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.

## Publishing

Go into the `package.json` and give your package the desired name through the `"name"` option. Also consider adding a `"license"` field and point it to a `LICENSE` file which you can create from a template (one popular option is the [MIT license](https://opensource.org/license/mit/)).

To publish your library to [npm](https://www.npmjs.com):

```sh
npm publish
```
