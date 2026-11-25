import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="card max-w-md p-10 text-center">
        <div className="mb-4 text-6xl" aria-hidden="true">🍽️</div>
        <h1 className="mb-2 text-3xl font-extrabold text-brown">الصفحة غير موجودة</h1>
        <p className="mb-6 text-mocha">ربما تغيّر الرابط أو انتهت صلاحيته.</p>
        <Link href="/" className="btn btn-primary">العودة للرئيسية</Link>
      </div>
    </div>
  );
}
