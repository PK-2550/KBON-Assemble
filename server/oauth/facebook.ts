import { createHmac } from 'node:crypto';

/**
 * ตรวจ access token ของ Facebook Login ฝั่งเว็บ
 *
 * ต่างจาก Google ตรงที่ Facebook ฝั่งเว็บไม่มี ID token ให้ verify แบบออฟไลน์
 * (OIDC ของ Facebook มีเฉพาะ Limited Login บน iOS/Android) สิ่งที่ SDK ฝั่ง
 * เบราว์เซอร์คืนมาคือ access token ธรรมดา ซึ่งตัวมันเองไม่ได้บอกว่าออกให้ใคร
 * หรือออกให้แอปไหน จึงต้องถาม Graph API เป็นคนยืนยันให้
 *
 * ขั้นตอน
 *   1. debug_token  ถามว่า token นี้ยังใช้ได้ไหม และ "ออกให้แอปของเราหรือเปล่า"
 *   2. /me          ดึงชื่อ อีเมล รูป มาใช้สร้างหรือผูกบัญชี
 *
 * ข้อ 1 ห้ามข้าม การเช็กแค่ว่า /me ตอบ 200 ไม่พอ เพราะ token ที่ออกให้แอปอื่น
 * ก็เรียก /me ผ่านเหมือนกัน ใครมีแอป Facebook ของตัวเองก็หลอกให้ผู้ใช้กดอนุญาต
 * แล้วเอา token นั้นมายิงใส่ระบบเราเพื่อสวมบัญชีคนอื่นได้ทันที
 * ตัวที่กันได้คือการเทียบ app_id ที่ debug_token ตอบกลับมาเท่านั้น
 */

const APP_ID = process.env.FACEBOOK_APP_ID;
const APP_SECRET = process.env.FACEBOOK_APP_SECRET;

/**
 * เวอร์ชันของ Graph API ที่ปักไว้
 *
 * ปักเวอร์ชันไว้ตรง ๆ ไม่ปล่อยให้ Facebook เลือกให้ เพราะถ้าไม่ระบุจะได้
 * เวอร์ชันเก่าสุดที่แอปยังใช้ได้ ซึ่งเปลี่ยนเองเงียบ ๆ ตอนเวอร์ชันนั้นหมดอายุ
 * จะขยับเวอร์ชันเมื่อไหร่ก็แก้ที่นี่ที่เดียว
 */
const GRAPH_VERSION = 'v21.0';
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

/** ไม่รอ Facebook นานเกินไป ผู้ใช้กำลังค้างอยู่หน้าเข้าสู่ระบบ */
const TIMEOUT_MS = 8_000;

/** เปิดใช้งานได้หรือยัง -- ต้องมีครบทั้งสองค่า */
export const facebookLoginEnabled = Boolean(APP_ID && APP_SECRET);

export interface FacebookProfile {
  id: string;
  name: string | null;
  email: string;
  picture: string | null;
}

/**
 * ผลการตรวจ token
 *
 * แยกแต่ละกรณีเป็น status ของตัวเอง ไม่ยุบเป็น boolean + ข้อความ เพราะผู้เรียก
 * ต้องตอบผู้ใช้คนละแบบ: token ไม่ถูกต้องคือ 401 ไม่มีอีเมลคือ 400 พร้อมบอกวิธีแก้
 * ส่วนติดต่อ Facebook ไม่ได้คือ 503 ซึ่งไม่ใช่ความผิดของผู้ใช้เลย
 */
export type FacebookVerifyResult =
  | { status: 'ok'; profile: FacebookProfile }
  /** token ใช้ไม่ได้ หมดอายุ หรือออกให้แอปอื่น */
  | { status: 'invalid_token' }
  /** token ใช้ได้ แต่บัญชีนี้ไม่มีอีเมลให้เรา */
  | { status: 'no_email' }
  /** ติดต่อ Facebook ไม่ได้ -- คนละเรื่องกับ token ไม่ถูกต้อง */
  | { status: 'unavailable' };

/**
 * ลายเซ็นกำกับ access token
 *
 * จำเป็นเมื่อแอปเปิดตัวเลือก "Require app secret proof for server API calls"
 * ใส่ไปเลยทุกครั้ง เพราะแอปที่ไม่ได้เปิดตัวเลือกนี้ก็รับได้โดยไม่มีผลข้างเคียง
 */
function appSecretProof(accessToken: string): string {
  return createHmac('sha256', APP_SECRET!).update(accessToken).digest('hex');
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) return null;
  return res.json();
}

export async function verifyFacebookToken(accessToken: string): Promise<FacebookVerifyResult> {
  if (!APP_ID || !APP_SECRET) return { status: 'unavailable' };

  const proof = appSecretProof(accessToken);

  let debug: unknown;
  let me: unknown;
  try {
    // ใช้ app access token (APP_ID|APP_SECRET) เรียก debug_token ตามที่ Facebook กำหนด
    debug = await getJson(
      `${GRAPH}/debug_token?input_token=${encodeURIComponent(accessToken)}` +
        `&access_token=${encodeURIComponent(`${APP_ID}|${APP_SECRET}`)}`
    );

    const data = (debug as { data?: { is_valid?: boolean; app_id?: string } } | null)?.data;
    // app_id ต้องเป็นของแอปเรา ไม่ใช่แค่ token ที่ยังไม่หมดอายุ
    if (!data?.is_valid || String(data.app_id) !== APP_ID) {
      return { status: 'invalid_token' };
    }

    me = await getJson(
      `${GRAPH}/me?fields=id,name,email,picture.type(large)` +
        `&access_token=${encodeURIComponent(accessToken)}` +
        `&appsecret_proof=${proof}`
    );
  } catch {
    // timeout หรือเน็ตพัง -- ไม่ใช่ความผิดของผู้ใช้ จึงไม่ตอบว่า token ไม่ถูกต้อง
    return { status: 'unavailable' };
  }

  const user = me as {
    id?: string;
    name?: string;
    email?: string;
    picture?: { data?: { url?: string; is_silhouette?: boolean } };
  } | null;

  if (!user?.id) return { status: 'invalid_token' };

  // ระบบผูกบัญชีด้วยอีเมล บัญชีที่ไม่มีอีเมล (สมัครด้วยเบอร์โทร หรือไม่กดอนุญาต)
  // จึงไปต่อไม่ได้ ต้องบอกให้ผู้ใช้รู้ ไม่ใช่สร้างบัญชีลอยที่ล็อกอินซ้ำไม่ได้
  if (!user.email) return { status: 'no_email' };

  const pic = user.picture?.data;
  return {
    status: 'ok',
    profile: {
      id: user.id,
      name: user.name ?? null,
      email: user.email,
      // is_silhouette คือรูปแทนค่าเริ่มต้นของ Facebook ไม่ใช่รูปที่ผู้ใช้ตั้งเอง
      picture: pic?.url && !pic.is_silhouette ? pic.url : null,
    },
  };
}
