import type { Metadata } from "next";
import { TrackForm } from "./TrackForm";

export const metadata: Metadata = { title: "تتبع طلبك", robots: { index: false } };

export default function TrackPage() {
  return (
    <div className="container-page max-w-lg py-12">
      <div className="card space-y-5 p-6 sm:p-8">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold text-brown">تتبع طلبك</h1>
          <p className="mt-2 text-sm text-mocha">أدخل رقم الطلب ورقم الهاتف المستخدم عند الطلب.</p>
        </div>
        <TrackForm />
      </div>
    </div>
  );
}
