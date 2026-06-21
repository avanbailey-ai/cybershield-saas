import type { ReactNode } from 'react';

interface ContactEmailCardProps {
  title: string;
  email: string;
  description: string;
  icon?: ReactNode;
}

export default function ContactEmailCard({
  title,
  email,
  description,
}: ContactEmailCardProps) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <a
        href={`mailto:${email}`}
        className="mt-2 inline-block text-sm font-medium text-blue-400 hover:text-blue-300"
      >
        {email}
      </a>
      <p className="mt-2 text-sm leading-relaxed text-gray-400">{description}</p>
    </div>
  );
}
