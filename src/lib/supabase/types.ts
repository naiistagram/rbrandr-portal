// Plain row types — used directly across the app
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  role: "admin" | "client";
  company_name: string | null;
  service_type: "website" | "marketing" | "both" | "social_media" | "brand";
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  client_id: string;
  name: string;
  service_type: "website" | "marketing" | "both" | "social_media" | "brand";
  goals: string | null;
  competition: string | null;
  kpis: Json | null;
  brief: Json | null;
  status: "active" | "paused" | "completed" | "draft";
  created_at: string;
  updated_at: string;
}

export interface Asset {
  id: string;
  project_id: string;
  uploaded_by: string;
  name: string;
  file_url: string;
  file_type: string;
  file_size: number;
  category: "logo" | "brand" | "template" | "other";
  created_at: string;
}

export interface ContentItem {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  content_type: "post" | "story" | "reel" | "ad" | "email" | "blog" | "other";
  platform: string | null;
  status: "draft" | "in_review" | "approved" | "rejected" | "published";
  scheduled_date: string | null;
  file_urls: string[] | null;
  feedback: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Contract {
  id: string;
  project_id: string;
  title: string;
  file_url: string;
  type: "contract" | "terms";
  status: "pending" | "signed" | "expired";
  signature_data: string | null;
  signature_name: string | null;
  signed_at: string | null;
  created_at: string;
}

export interface Form {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  fields: Json;
  responses: Json | null;
  status: "pending" | "submitted";
  created_at: string;
  submitted_at: string | null;
}

export interface Report {
  id: string;
  project_id: string;
  title: string;
  period: string;
  file_url: string;
  summary: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: "content" | "contract" | "form" | "report" | "general";
  read: boolean;
  link: string | null;
  created_at: string;
}

export interface Milestone {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  due_date: string;
  completed: boolean;
  created_at: string;
}

export interface TicketMessage {
  role: "client" | "admin";
  text: string;
  created_at: string;
}

export interface Ticket {
  id: string;
  project_id: string;
  submitted_by: string | null;
  title: string;
  description: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: "open" | "in_progress" | "resolved" | "closed";
  file_urls: string[] | null;
  admin_response: string | null;
  messages: TicketMessage[];
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  project_id: string;
  uploaded_by: string | null;
  title: string;
  description: string | null;
  file_url: string;
  file_type: string;
  file_size: number;
  created_at: string;
}

export interface Feedback {
  id: string;
  project_id: string;
  submitted_by: string | null;
  rating: number | null;
  message: string;
  category: "general" | "service" | "platform" | "other";
  admin_reply: string | null;
  created_at: string;
}
