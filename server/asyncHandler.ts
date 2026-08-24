import type { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * ครอบ route handler ที่เป็น async
 *
 * Express 4 ไม่รู้จัก promise ถ้า handler เป็น async แล้ว throw ออกมา
 * error จะไม่ถูกส่งต่อไปยัง error middleware แต่กลายเป็น unhandled rejection
 * และ request จะค้างไว้เฉย ๆ จนกว่าจะ timeout ฝั่ง client
 *
 * ตัวช่วยนี้ดัก reject แล้วส่งเข้า next() ให้ error handler กลางจัดการ
 * (Express 5 ทำให้เองแล้ว ถ้าอัปเกรดเมื่อไหร่ตัวนี้เอาออกได้)
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
