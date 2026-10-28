import type { NewWork } from '../domain/work.js';
import { syntheticIsbn13 } from '../factories/synthetic-isbn13.js';

export const CATALOGUE_BOOKS: readonly NewWork[] = [
  {
    title: 'Krvavé sonety',
    authors: ['Pavol Országh Hviezdoslav'],
    editions: [{ isbn13: syntheticIsbn13(1), language: 'sk', title: null, publishedYear: 1919 }],
  },
  {
    title: 'Ťapákovci',
    authors: ['Božena Slančíková-Timrava'],
    editions: [{ isbn13: syntheticIsbn13(2), language: 'sk', title: null, publishedYear: 1914 }],
  },
  {
    title: 'Živý bič',
    authors: ['Milo Urban'],
    editions: [{ isbn13: syntheticIsbn13(3), language: 'sk', title: null, publishedYear: 1927 }],
  },
  {
    title: 'Tri gaštanové kone',
    authors: ['Margita Figuli'],
    editions: [{ isbn13: syntheticIsbn13(4), language: 'sk', title: null, publishedYear: 1940 }],
  },
  {
    title: 'Le Petit Prince',
    authors: ['Antoine de Saint-Exupéry'],
    editions: [
      { isbn13: syntheticIsbn13(5), language: 'fr', title: null, publishedYear: 1943 },
      { isbn13: syntheticIsbn13(6), language: 'sk', title: 'Malý princ', publishedYear: null },
    ],
  },
  {
    title: 'Nineteen Eighty-Four',
    authors: ['George Orwell'],
    editions: [
      { isbn13: syntheticIsbn13(7), language: 'en', title: null, publishedYear: 1949 },
      { isbn13: syntheticIsbn13(8), language: 'sk', title: '1984', publishedYear: null },
    ],
  },
  {
    title: 'Good Omens',
    authors: ['Terry Pratchett', 'Neil Gaiman'],
    editions: [
      { isbn13: syntheticIsbn13(9), language: 'en', title: null, publishedYear: 1990 },
      { isbn13: syntheticIsbn13(10), language: 'sk', title: 'Dobré znamenia', publishedYear: null },
    ],
  },
];
