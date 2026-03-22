export type Customer = {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  email?: string | null;
  birth_date?: string | null;
  investment_tendency?: "male" | "female" | "business" | "other" | null;
  status: "active" | "inactive";
  tags: string[];
  memo?: string | null;
  address?: string | null;
  detail_address?: string | null;
  postal_code?: string | null;
  created_at: string;
  updated_at: string;
  group_ids?: string[];
  address_book_id?: string | null;
};

export type CustomerFormData = {
  name: string;
  phone: string;
  email?: string;
  birth_date?: string;
  investment_tendency?: "male" | "female" | "business" | "other" | "";
  status: "active" | "inactive";
  tags?: string;
  memo?: string;
  address?: string;
  detail_address?: string;
  postal_code?: string;
};

export type Group = {
  id: string;
  user_id: string;
  name: string;
  description?: string | null;
  color: string;
  created_at: string;
  updated_at: string;
  member_count?: number;
  parent_id?: string | null;
  depth?: number;
  path?: string;
  children?: Group[];
};

export type CustomerGroup = {
  id: string;
  user_id: string;
  customer_id: string;
  group_id: string;
  created_at: string;
  customer?: Customer;
  group?: Group;
};

/** b-messenger_group_members 조인 테이블 */
export type GroupMember = {
  id: string;
  tenant_id: string;
  group_id: string;
  contact_id: string;
  added_at: string;
  contact?: Customer;
  group?: Group;
};

/** b-messenger_send_targets — 발송 대상 지정 */
export type SendTarget = {
  id: string;
  tenant_id: string;
  campaign_id: string;
  /** 발송 대상 종류: 그룹 / 개인 연락처 / 필터 */
  target_type: 'group' | 'contact' | 'filter';
  group_id?: string | null;
  contact_id?: string | null;
  filter_json?: Record<string, unknown> | null;
  estimated_count?: number;
  created_at: string;
};

/** b-messenger_campaign_filters — 저장된 필터 조합 */
export type CampaignFilter = {
  id: string;
  tenant_id: string;
  name: string;
  filter_json: {
    groups?: string[];
    tags?: string[];
    gender?: string;
    address_book_id?: string;
    min_amount?: number;
    max_amount?: number;
    [key: string]: unknown;
  };
  created_at: string;
  updated_at: string;
};

export type SubscriptionPlan = 'Free' | 'Pro' | 'Enterprise';

export type UserProfile = {
  id: string;
  email: string;
  is_admin: boolean;
  plan: SubscriptionPlan;
  status: 'pending' | 'approved' | 'rejected';
  plan_request?: SubscriptionPlan | null;
  depositor_name?: string | null;
  payment_status?: 'pending' | 'completed' | 'failed' | 'downgrade_reserved' | null;
  plan_request_at?: string | null;
  subscription_end_date?: string | null;
  created_at: string;
};

export type PaymentLog = {
  id: string;
  user_id: string;
  plan_name: string;
  amount: number;
  depositor_name: string;
  status: 'pending' | 'approved' | 'rejected';
  start_date?: string | null;
  end_date?: string | null;
  requested_at: string;
  processed_at?: string | null;
  user?: UserProfile;
};
