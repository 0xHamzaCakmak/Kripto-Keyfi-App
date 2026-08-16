import { videoUserProfileSections } from '../videos/video-user-profile-sections.js';
import { userProfileSectionRegistry } from './user-profile-section.registry.js';

userProfileSectionRegistry.register(...videoUserProfileSections);

export const fetchUserProfileSections = (userId: string) => userProfileSectionRegistry.fetchAll(userId);
