# Instalace a offline

Invoo se dá nainstalovat jako aplikace (Chrome, Edge, Android, Safari přes „Přidat na plochu“) a po jedné online návštěvě
se otevře i bez připojení. Nic z toho nevyžaduje účet ani server: aplikace dál běží celá v prohlížeči a žádná data
neodcházejí.

## Instalace

V Chromu a Edgi se v adresním řádku objeví tlačítko Instalovat, na telefonu nabídka „Přidat na plochu“. Ikony vznikají
z loga projektu (`public/favicon.svg`) příkazem `pnpm icons` a jsou uložené v `public/icons/`.

## Offline po jedné návštěvě

Při první návštěvě si prohlížeč stáhne všechny soubory aplikace do Cache Storage: stránku, skripty, styly, obě písma
(všechny jazykové podmnožiny), ikony a licence písem. Dohromady je to zhruba 0,7 MB. Pak se aplikace otevře i bez
připojení a funguje jako online, včetně odkazů typu `#faktury`.

Co service worker (`src/pwa/sw.ts`) dělá a nedělá:

- odpovídá jen na požadavky GET na stejný původ a uvnitř adresáře aplikace; cokoli jiného nechává prohlížeči,
- soubory bere z mezipaměti aktuální verze; když v ní chybí (prohlížeč ji smí vyčistit), stáhne je ze sítě a při
  připojení si mezipaměť jednou znovu naplní, takže offline znovu funguje i bez nové verze,
- za stránku aplikace pokládá jen kořen adresáře a `index.html`; jiné adresy (například neexistující) nechává serveru,
- nikam nic neodesílá a nesahá do `localStorage`.

## Nová verze

Po nasazení nové verze si prohlížeč stáhne nový `sw.js` a ukáže hlášku „Nová verze“ s tlačítky **Načíst novou
verzi** a **Později**. Hláška je pruh úplně nahoře na stránce; posune obsah dolů, takže nic nepřekrývá. Zobrazí se až po
stažení všech souborů a otevřená stránka se sama nepřepne.

- Před načtením si ulož rozdělané úpravy. Koncept nové faktury se ukládá průběžně, úpravy uložené faktury a nastavení
  ne.
- Až jsou zavřené všechny karty a okna Invoo, další otevření už rovnou spustí novou verzi bez ptaní.
- **Později** hlášku skryje do další nové verze nebo dalšího otevření stránky; po něm se zaostření vrátí na prvek,
  odkud přišlo. Escape hlášku také zavře.
- Když novou verzi načte jiná karta, hláška se v ostatních otevřených kartách objeví znovu.
- Jestli je nová verze k dispozici, se zjišťuje při každém otevření stránky a při návratu na kartu, nejvýše jednou za
  hodinu.
- Starší mezipaměti `invoo-*` téhož adresáře se po aktivaci smažou (název nese cestu aplikace, takže jiná kopie na
  stejném původu zůstane); faktury v `localStorage` (`invoo.data.v3`) se tím nemění.

## Odstranění

Nainstalovanou aplikaci odinstaluješ jako každou jinou. Mezipaměť a service worker smaže v DevTools záložka
Application → Storage → Clear site data (tím se smažou i uložené faktury, nejdřív je exportuj).

## Pro vývoj

- `pnpm dev` service worker neregistruje, běží jen v produkčním sestavení. Vyzkoušíš ho přes `pnpm build && pnpm preview`.
- Vite plugin `tools/serviceWorkerPlugin.ts` při sestavení vytvoří `dist/sw.js`, dosadí seznam souborů a verzi (hash
  obsahu všech souborů). Sestavení selže, když `sw.js` obsahuje `import`/`export` nebo nedosazený zástupný znak.
- Sestavení navíc po zápisu ověří, že seznam souborů v `sw.js` odpovídá souborům v `dist` (bez `sw.js`, `CNAME`, map
  a souborů s tečkou).
- Každé nasazení musí vždy nést `sw.js` na stejné adrese. Když zmizí, nainstalované kopie zůstanou na staré verzi a
  nová se k nim nedostane.
- TypeScript je rozdělený na projekty `tsconfig.app.json` (prohlížeč, bez Node typů), `tsconfig.test.json` a
  `tsconfig.node.json` (`tools`, konfigurace); `pnpm typecheck` kontroluje všechny.
- Všechny adresy jsou relativní, takže stejné sestavení funguje na `https://invoo.cz/` i pod cestou `/Invokit/`.
- `pnpm icons` přegeneruje PNG ikony (`tools/generateIcons.ts`, Node 22 bez dalších závislostí); test hlídá, že
  uložené soubory odpovídají generátoru.
- Kontrola instalovatelnosti: DevTools → Application → Manifest.
