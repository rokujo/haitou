import { NextResponse } from "next/server";

// 開発・テスト用の手動トリガー。Functions の HTTP エンドポイントにフォワードする。
// 本番デプロイ時は削除するか、認証チェックを追加すること。
export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  const target = process.env.NEXT_PUBLIC_TRIGGER_FUNCTION_URL;

  if (!target) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_TRIGGER_FUNCTION_URL is not set" },
      { status: 500 },
    );
  }
  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const res = await fetch(`${target}?userId=${encodeURIComponent(userId)}`, {
    method: "POST",
  });
  const text = await res.text();
  return new NextResponse(text, { status: res.status });
}
