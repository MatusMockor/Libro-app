export interface NewEdition {
  readonly isbn13: string | null;
  readonly language: string;
  readonly title: string | null;
  readonly publishedYear: number | null;
}

export interface NewWork {
  readonly title: string;
  readonly authors: readonly string[];
  readonly editions: readonly NewEdition[];
}

export interface Author {
  readonly id: string;
  readonly name: string;
}

export interface Edition extends NewEdition {
  readonly id: string;
}

export interface Work {
  readonly id: string;
  readonly title: string;
  readonly authors: readonly Author[];
  readonly editions: readonly Edition[];
}
