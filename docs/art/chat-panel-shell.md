# Chat panel shell (2026-10-11)

A local-only MMORPG chat shell in the lower-left HUD (`src/ui/hud/ChatPanel.ts`, `src/ui/hud/chatLog.ts`). It has
no networking, server, input bar or player-to-player messages; it is the game's own message log presented as chat.

## Channels

| Tab | Shows |
|---|---|
| All | every logged message |
| Party | party messages. Nothing produces them yet (there is no party system), so it shows a clean empty state |
| System | game and system notices (below) |

Guild, Whisper, Trade and Global are not shown: they have no backing data.

## Data model

`ChatLog` holds `{ id, channel ('party' | 'system'), kind, text, color?, at, source? }`. History is bounded to the
newest **150** messages and older ones are dropped. It lives in memory only (not saved, not synced) and is created
with the HUD.

## What goes to System

- **Everything the loot feed shows, archived as it appears:** Gold and items, equipment pickups and ground drops,
  bag full, blocked entry / progress, quest accepted / objectives done / complete with its rewards, Story tutorial
  hints, checkpoints, party wipes and retries, and dungeon failure. A stacked feed line ("+3 Wolf Fang") updates
  its logged message instead of adding another.
- **Chat-only notices** (their world text stays where it was): level up, feature unlocked, job changed, entering a
  map (debug resets excluded) and boss defeated.

These stay as world / HUD combat feedback only: damage and heal numbers, misses, ENRAGED and the boss status chip,
telegraphs, Dodge, hit reactions, the status rows and the "Retry point updated" pulse.

## Loot feed coexistence

The feed stays the instant combat feedback, unchanged. Each of its lines is marked *live* while it is on screen,
and the compact chat preview skips live messages and any text the feed is currently showing. A line therefore
appears in the preview only after it has left the feed, and never twice at once. While the chat is expanded the
feed hides, since its lines are in the log.

## Behaviour

- **Compact:** a small translucent preview between the feed and the touch joystick's idle ring. It shows the
  latest one or two messages and an unread count. It is fully visible for 6 s after a new message, then
  quietens, but never disappears. Tapping it expands the chat. It is narrow enough to keep the movement area and
  the floating-joystick zone free.
- **Expanded:** the panel grows upward from just above the system strip. It holds the tabs, a scrollable log
  (touch pan, contained overscroll) and a close button, with a "Local log" note on larger screens. It covers no
  combat socket, system button, player frame or status row.
- No keyboard binding (no gameplay key is taken). Updates are event-driven: a new message appends one node, the
  list is rebuilt only on a tab or language change, and nothing runs per frame.
- Strings are in the string table (`chat.*`, en / th). Notices the chat creates itself are localized; lines
  archived from the feed keep the feed's English game text, as before.

## Verification

`tests/browser/chat.test.mjs` (`--chat-review`, also in the full suite) covers:

- real kill / quest / level / map messages, and no preview duplicate of visible feed lines (including a re-sent hint)
- expand / collapse, All / Party / System, and the Party empty state
- ATK still working with the panel open, a press on the preview never starting the joystick, and a world drag
  still moving the hero
- the 150-message bound in log and DOM
- geometry at 960×540, 844×390 and 640×360, and Thai at 640×360

## Deferred (post-Demo)

Online chat (WebSocket / server), sending messages (input bar), Party / Guild / Whisper / Trade / Global channels,
friends, block list, moderation, emoji / stickers, voice chat, persisted history and timestamps in the UI.
