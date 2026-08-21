type SuperadminSessionPayload = {
  sub: string;
  email: string;
  role: "superadmin";
  exp: number;
};

export type { SuperadminSessionPayload };
