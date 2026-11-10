# Clan-Rollen-Bot

Discord-Bot, mit dem Clan-Anführer und Clan-Assistenten Clan-Rollen vergeben und entziehen können. Mitglieder können ihre Clan-Rollen selbst entfernen. Es gibt Prefix-Befehle (`-clantag @User`) und Slash-Befehle (`/clantag user:@User`).

Alles, was man anpassen kann (Texte, Farben, Kanäle, Rollen, Befehlsnamen, Logs), steht in der `config.json`. In `index.js` muss nichts geändert werden.

## Befehle

| Prefix | Slash | Wer darf (Standard) | Wirkung |
|---|---|---|---|
| `-clanexit` | `/clanexit` | alle | Entfernt alle Clan-Rollen aus `roles.json` von dir selbst |
| `-clantag <user>` | `/clantag user:<user>` | Anführer, Assistent | Toggle: Vergibt oder entzieht die Clan-Rolle, die der Ausführende im Profil hat |
| `-clanhelper <user>` | `/clanhelper user:<user>` | Anführer | Toggle: Vergibt oder entzieht die Assistenten-Rolle |

Bei `-clantag` muss der Ausführende genau eine Clan-Rolle aus `roles.json` haben. Bei keiner oder mehreren gibt der Bot eine Fehlermeldung aus.

## Setup

1. **Developer Portal:** Bot anlegen, Token kopieren. Unter *Bot → Privileged Gateway Intents* aktivieren: **Server Members Intent** und **Message Content Intent** (für Prefix-Befehle).
2. **Einladen:** Scopes `bot` und `applications.commands`. Rechte: View Channels, Send Messages, Embed Links, Manage Messages, Manage Roles.
3. **Rollenhierarchie:** Die Bot-Rolle muss über allen Clan-Rollen und der Assistenten-Rolle stehen.
4. **Installieren:** `npm install`
5. **Konfigurieren:** Token in `.env`, Clan-Rollen-IDs in `roles.json`, Rest in `config.json`.
6. **Starten:** `npm start`

## Dateien

| Datei | Inhalt |
|---|---|
| `index.js` | Bot-Code |
| `.env` | Geheime Schlüssel (Bot-Token). Nie veröffentlichen! |
| `config.json` | Alle Einstellungen und Texte |
| `roles.json` | Liste der Clan-Rollen-IDs |
| `package.json` | Abhängigkeiten und Startbefehl |

## config.json

### `prefix`
| Feld | Bedeutung |
|---|---|
| `enabled` | Prefix-Befehle an/aus |
| `symbol` | Das Präfix, z. B. `-` |
| `blockedChannels` | Kanal-IDs, in denen keine Prefix-Befehle funktionieren |
| `wrongChannelAction` | `ignore` (still bleiben) oder `reply` (Hinweis schicken) |

### `slash`
| Feld | Bedeutung |
|---|---|
| `enabled` | Slash-Befehle an/aus |
| `guildId` | Server-ID. Leer = global registrieren (kann bis zu einer Stunde dauern) |

### `roles`
Anführer und Assistent. Die Namen (`leader`, `assistant`) werden in `commands.*.allowedRoles` und `roleSource` verwendet.

### `commands`
Pro Befehl:

| Feld | Bedeutung |
|---|---|
| `name` | Befehlsname (ohne Prefix/Slash) |
| `description` | Beschreibung für Slash |
| `action` | `exit` (eigene Rollen entfernen) oder `toggle` (Rolle vergeben/entziehen) |
| `roleSource` | Nur bei `toggle`: `executorClanRole` (Clan-Rolle des Ausführenden) oder ein Name aus `roles` |
| `slash` / `prefix` | Befehl als Slash/Prefix verfügbar |
| `prefixChannels` | Kanal-IDs, in denen der Prefix-Befehl erlaubt ist. Leer = überall |
| `allowedRoles` | Namen aus `roles`, die den Befehl nutzen dürfen. Leer = alle |
| `noPermission` | Pfad des Fehlertextes in `messages` |
| `needsUser` / `optionName` / `optionDescription` | Slash-Option für das Mitglied |
| `auditReason` | Text im Server-Audit-Log |

### `responses`
- `slash.type`: `embed` oder `text`. `slash.ephemeral`: nur für den Ausführenden sichtbar.
- `prefix.type`: `text` oder `embed`.
- `prefix.replyToMessage`, `pingUser`, `deleteCommand`, `deleteReply`, `deleteAfterSeconds` (`0` = nie löschen).

### `colors`, `embedTitles`, `icons`
Farben (Hex) und optionale Titel für Embeds sowie Icons vor Textantworten, je für `success`, `error`, `info`.

### `messages`
Alle Texte. Platzhalter: `{user}`, `{role}`, `{roles}`, `{usage}`, `{channels}`, `{executor}`, `{target}`, `{command}`, `{error}`. Unter `messages.logs` stehen die Log-Texte.

### `console`
Alle Konsolenmeldungen des Bots.

### `logs` (ganz unten)
| Feld | Bedeutung |
|---|---|
| `channelId` | Log-Kanal (nötig für `channel` und `all`) |
| `default` | Modus für Aktionen ohne eigenen Eintrag |
| `modes` | Welcher Modus wohin schreibt |
| `actions` | Modus pro Aktion |

Modi: `disable` (nichts), `console`, `channel`, `all` (Konsole und Kanal).
Aktionen: `clanexit.done`, `clantag.added`, `clantag.removed`, `clanhelper.added`, `clanhelper.removed`, `error`.

## Fehlerbehebung

| Problem | Lösung |
|---|---|
| `Used disallowed intents` | Beide Intents im Developer Portal aktivieren |
| Slash-Befehle fehlen | `slash.guildId` prüfen, Bot mit `applications.commands` einladen |
| `Missing Permissions` | Bot-Rolle in der Hierarchie nach oben, *Manage Roles* prüfen |
| Nachrichten werden nicht gelöscht | *Manage Messages* im Kanal nötig |

-# Hinweis: Diese Readme wurde mit Unterstützung von einer KI / AI geschrieben.
