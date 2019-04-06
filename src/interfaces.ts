
interface Course {
  // based on the observed response, don't know what it all means
  id: number,
  name: string,
  account_id: number,
  uuid: string,
  start_at: Date,
  grading_standard_id: null,
  is_public: boolean,
  created_at: Date,
  course_code: string,
  default_view: 'modules' | 'wiki' | 'syllabus' | 'feed' | string,
  root_account_id: number,
  enrollment_term_id: number,
  license: 'private' | string,
  end_at: Date,
  public_syllabus: boolean,
  public_syllabus_to_auth: boolean,
  storage_quota_mb: number,
  is_public_to_auth_users: boolean,
  apply_assignment_group_weights: boolean,
  locale: 'en' | string,
  calendar: { ics: string /*a link*/ },
  time_zone: string,
  blueprint: boolean,
  enrollments: {
    type: 'student' | string,
    role: 'StudentEnrollment' | string,
    role_id: number,
    user_id: number,
    enrollment_state: 'active' | string
  }[],
  hide_final_grades: boolean,
  workflow_state: 'available' | string,
  restrict_enrollments_to_course_dates: boolean
}

interface File {
  id: number,
  uuid: string,
  folder_id: number,
  display_name: string,
  filename: string,
  workflow_state: 'processing' | string,
  'content-type': string,
  url: string, // link to download actual bytes of files
  size: number,
  created_at: Date,
  updated_at: Date,
  unlock_at: null,
  locked: boolean,
  hidden: boolean,
  lock_at: null,
  hidden_for_user: boolean,
  thumbnail_url: null,
  modified_at: string, // timestamp
  mime_class: string,
  media_entry_id: null,
  locked_for_user: boolean
}
