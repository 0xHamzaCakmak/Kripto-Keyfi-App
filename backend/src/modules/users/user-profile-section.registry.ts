import { logger } from '../../utils/logger.js';

export type UserProfileSectionDefinition = {
  key: string;
  title: string;
  fetch: (userId: string) => Promise<unknown>;
  actions?: UserProfileSectionAction[];
};

export type UserProfileSectionAction = {
  key: string;
  label: string;
  method: 'DELETE' | 'POST' | 'PATCH';
  endpoint: string;
  confirm?: string;
  tone?: 'default' | 'danger';
};

export type UserProfileSectionResult = {
  key: string;
  title: string;
  data: unknown;
  actions: UserProfileSectionAction[];
};

export function createUserProfileSectionRegistry(initialSections: UserProfileSectionDefinition[] = []) {
  const sections = [...initialSections];
  return {
    register(...definitions: UserProfileSectionDefinition[]) {
      for (const definition of definitions) {
        if (sections.some((section) => section.key === definition.key)) throw new Error(`Duplicate user profile section: ${definition.key}`);
        sections.push(definition);
      }
    },
    async fetchAll(userId: string): Promise<UserProfileSectionResult[]> {
      const results = await Promise.all(sections.map(async (section) => {
        try {
          return { key: section.key, title: section.title, data: await section.fetch(userId), actions: section.actions ?? [] };
        } catch (error) {
          logger.warn({ section: section.key, userId, err: error }, 'user profile section could not be loaded');
          return null;
        }
      }));
      return results.filter((result): result is UserProfileSectionResult => result !== null);
    },
  };
}

export const userProfileSectionRegistry = createUserProfileSectionRegistry();
