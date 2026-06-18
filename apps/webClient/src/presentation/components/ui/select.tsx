import { Label } from "./label";

export interface SelectProps {
  label?: string;
  name: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  value?: string;
}

export const Select = ({
  label,
  name,
  options,
  onChange,
  value,
}: SelectProps) => {
  return (
    <div className="space-y-2">
      {label && <Label htmlFor={name}>{name}</Label>}
      <select
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:ring-offset-slate-950 dark:focus-visible:ring-slate-800"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
};
