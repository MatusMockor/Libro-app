import { In, type DataSource, type Repository } from 'typeorm';
import type { Seeder, SeederFactoryManager } from 'typeorm-extension';
import type { NewWork } from '../domain/work.js';
import type { WorkFactoryMeta } from '../factories/work.factory.js';
import { EditionEntity } from '../persistence/edition.entity.js';
import { WorkEntity } from '../persistence/work.entity.js';
import { CATALOGUE_BOOKS } from './catalogue-books.js';

export default class BooksSeeder implements Seeder {
  async run(dataSource: DataSource, factoryManager: SeederFactoryManager): Promise<void> {
    const editions = dataSource.getRepository(EditionEntity);
    const works = factoryManager.get<WorkEntity, WorkFactoryMeta>(WorkEntity);

    for (const book of CATALOGUE_BOOKS) {
      if (await isInCatalogue(editions, book)) {
        continue;
      }

      await works.setMeta(book).save();
    }
  }
}

function isInCatalogue(editions: Repository<EditionEntity>, book: NewWork): Promise<boolean> {
  const isbns = book.editions.flatMap(({ isbn13 }) => (isbn13 ? [isbn13] : []));

  return editions.existsBy({ isbn13: In(isbns) });
}
