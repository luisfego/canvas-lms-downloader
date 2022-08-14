export interface Course {
    id: number,
    name: string,
    course_code:string, 
    syllabus_body: string
}

export interface File {
    folder_id: number,
    filename: string,
    url: string, // link to download actual bytes of files
    modified_at: string, // timestamp
    locked_for_user: boolean,
    lock_explanation: string
}

export interface Folder {
    id: number,
    full_name: string // folder path relative to course/<id>/files
}

export interface Page {
    url: string;
    updated_at: string;
}

export interface Announcement {
    id:string;
    title:string;
    created_at: string;
    message:string;
    posted_at: string;
}

export interface Module {
    id: number,
    name: string,
    position: number,
    unlock_at: null|any,
    require_sequential_progress: boolean,
    publish_final_grade: boolean,
    prerequisite_module_ids: Array<any>,
    state: 'completed'|string,
    completed_at: string, // iso date string
    items_count: number,
    items_url: string;
}

export interface ModuleItem  {
    id: number,
    title: string,
    position: number,
    indent: number,
    type: 'Assignment'|string,
    module_id: number,
    html_url: string,
    content_id: number,
    url: string,
    external_url: string;
}