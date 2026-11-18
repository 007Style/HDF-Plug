import React from 'react';

export const Card: React.FC<{ title: string; children: React.ReactNode; role?: 'status' | 'alert' }> = ({ title, children, role }) => (
  <section className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3" role={role} aria-label={title}>
    <h1 className="text-base font-semibold">{title}</h1>
    {children}
  </section>
);

export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean }> = ({ primary, className, ...rest }) => (
  <button
    {...rest}
    className={`rounded-md px-3 py-1.5 text-sm font-medium border ${
      primary ? 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700' : 'bg-white border-gray-300 text-gray-800 hover:bg-gray-100'
    } disabled:opacity-60 ${className ?? ''}`}
  />
);
