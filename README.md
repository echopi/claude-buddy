# claude-buddy

A [Claude Code skill](https://docs.anthropic.com/en/docs/claude-code) for inspecting, hunting, and stamping `/buddy` companion seeds.

Claude Code ships with a virtual pet system (`/buddy`). Each pet is deterministically derived from a seed in your config. This skill lets you:

- **Inspect** your current buddy's species, rarity, stats, and ASCII art
- **Hunt** for a buddy matching specific criteria (species, rarity, shiny, etc.)
- **Stamp** a chosen seed into your config to get the buddy you want

## Install

Copy this folder into your Claude Code skills directory:

```bash
cp -r claude-buddy ~/.claude/skills/
```

Then use `/buddy` or say "hunt buddy" in Claude Code.

## Standalone usage

The roller script also works standalone with Node.js (v18+):

```bash
# Show your current buddy
node roller.mjs inspect

# Hunt for a legendary dragon
node roller.mjs hunt --species dragon --rarity legendary --limit 3

# Apply a seed (backs up config first)
node roller.mjs stamp <seed>
```

## How it works

The script replicates Claude Code's buddy derivation algorithm:

1. Your seed (from `~/.claude.json`) is combined with a salt
2. FNV-1a hashes the string into a 32-bit integer
3. splitmix32 PRNG generates species, rarity, hat, eyes, shiny, and stats
4. The hunt command brute-forces random seeds until matches are found

## Probability table

| Rarity    | Chance | Stat Floor | Hat |
|-----------|--------|------------|-----|
| Common    | 60%    | 5          | No  |
| Uncommon  | 25%    | 15         | Yes |
| Rare      | 10%    | 25         | Yes |
| Epic      | 4%     | 35         | Yes |
| Legendary | 1%     | 50         | Yes |

Shiny: 1% chance on any rarity. 18 species available.

## License

MIT
