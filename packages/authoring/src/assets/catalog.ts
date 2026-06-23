import { readFileSync } from 'node:fs'

/** Mirror of `assets/library.json` (assets/visual lane owns the shape). */
export interface LibraryTile {
  colorId: number
  file: string
  description: string
}
export interface LibraryBackground {
  file: string
  description: string
}
export interface LibraryTheme {
  background: LibraryBackground
  tiles: LibraryTile[]
}
export interface LibraryShared {
  name: string
  file: string
  description: string
}
export type SharedKind = 'overlay' | 'blocker' | 'texture_9slice' | 'particle'
export interface LibraryJson {
  version: number
  tile_size: number
  kind: string
  themes: Record<string, LibraryTheme>
  shared: Record<SharedKind, LibraryShared[]>
}

/**
 * The model's "eye": a queryable view over the asset library. Powers the asset tools and —
 * critically — `validate_asset_refs`, the hard guard that rejects any file/name the weak
 * model invents. Constructed from injected JSON so tests don't touch the filesystem.
 */
export class AssetCatalog {
  private readonly fileRefs = new Set<string>()
  private readonly nameRefs = new Set<string>()

  constructor(private readonly lib: LibraryJson) {
    for (const theme of Object.values(lib.themes)) {
      this.fileRefs.add(theme.background.file)
      for (const tile of theme.tiles) this.fileRefs.add(tile.file)
    }
    for (const list of Object.values(lib.shared)) {
      for (const asset of list) {
        this.fileRefs.add(asset.file)
        this.nameRefs.add(asset.name)
      }
    }
  }

  themeIds(): string[] {
    return Object.keys(this.lib.themes)
  }

  hasTheme(id: string): boolean {
    return id in this.lib.themes
  }

  getTheme(id: string): LibraryTheme | undefined {
    return this.lib.themes[id]
  }

  shared(kind?: SharedKind): LibraryShared[] {
    if (kind) return this.lib.shared[kind] ?? []
    return Object.values(this.lib.shared).flat()
  }

  /** A ref is valid if it's a known asset file path OR a known shared asset name. */
  hasRef(ref: string): boolean {
    return this.fileRefs.has(ref) || this.nameRefs.has(ref)
  }

  /** The subset of `refs` that don't exist — the anti-hallucination signal. */
  unknownRefs(refs: string[]): string[] {
    return refs.filter((ref) => !this.hasRef(ref))
  }
}

export function loadCatalogFromFile(path: string): AssetCatalog {
  return new AssetCatalog(JSON.parse(readFileSync(path, 'utf8')) as LibraryJson)
}
