import type {AppLocale} from "@/i18n/routing";
import type {AppRole} from "@/types/database";

export type UserProfile = {
  id: string;
  email: string | null;
  fullName: string | null;
  role: AppRole | null;
  locale: AppLocale;
};
