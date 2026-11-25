import { PhoneIcon, WhatsappIcon } from "@/components/Icons";

// Rendered only when the restaurant has configured real contact details in the admin panel.
export function ContactButtons({
  phone,
  whatsapp,
  size = "md",
}: {
  phone: string;
  whatsapp: string;
  size?: "md" | "sm";
}) {
  if (!phone && !whatsapp) return null;
  const cls = size === "sm" ? "btn btn-sm" : "btn";
  return (
    <div className="flex flex-wrap items-center gap-3">
      {phone && (
        <a href={`tel:${phone}`} className={`${cls} btn-outline`}>
          <PhoneIcon className="h-4 w-4" /> اتصل بنا
        </a>
      )}
      {whatsapp && (
        <a
          href={`https://wa.me/${whatsapp}?text=${encodeURIComponent("مرحباً، أود الاستفسار عن طلب من كشري ابن العمراوي")}`}
          target="_blank"
          rel="noopener noreferrer"
          className={`${cls} bg-[#1f9d55] text-white hover:bg-[#16793f]`}
        >
          <WhatsappIcon className="h-4 w-4" /> واتساب
        </a>
      )}
    </div>
  );
}
