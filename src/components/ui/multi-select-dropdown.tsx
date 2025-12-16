import * as React from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

export interface MultiSelectOption {
  value: string;
  label: string;
  color?: string;
}

interface MultiSelectDropdownProps {
  options: MultiSelectOption[];
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
  disabled?: boolean;
  maxDisplay?: number;
}

export function MultiSelectDropdown({
  options,
  values,
  onChange,
  placeholder = 'Selecionar...',
  searchPlaceholder = 'Buscar...',
  emptyMessage = 'Nenhum resultado encontrado.',
  className,
  disabled = false,
  maxDisplay = 2,
}: MultiSelectDropdownProps) {
  const [open, setOpen] = React.useState(false);

  const selectedOptions = options.filter((option) => values.includes(option.value));

  const handleSelect = (optionValue: string) => {
    if (values.includes(optionValue)) {
      onChange(values.filter((v) => v !== optionValue));
    } else {
      onChange([...values, optionValue]);
    }
  };

  const handleRemove = (optionValue: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(values.filter((v) => v !== optionValue));
  };

  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              'w-full justify-between font-normal h-9',
              values.length === 0 && 'text-muted-foreground',
              className
            )}
          >
            <span className="truncate">
              {values.length === 0
                ? placeholder
                : values.length === 1
                ? selectedOptions[0]?.label
                : `${values.length} selecionados`}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              {values.length > 0 && (
                <X
                  className="h-3.5 w-3.5 opacity-50 hover:opacity-100"
                  onClick={handleClearAll}
                />
              )}
              <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command>
            <CommandInput placeholder={searchPlaceholder} className="h-9" />
            <CommandList>
              <CommandEmpty>{emptyMessage}</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.label}
                    onSelect={() => handleSelect(option.value)}
                  >
                    {option.color && (
                      <span
                        className="w-3 h-3 rounded-full mr-2 shrink-0"
                        style={{ backgroundColor: option.color }}
                      />
                    )}
                    <span className="truncate">{option.label}</span>
                    <Check
                      className={cn(
                        'ml-auto h-4 w-4 shrink-0',
                        values.includes(option.value) ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Selected badges */}
      {selectedOptions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedOptions.slice(0, maxDisplay).map((option) => (
            <Badge
              key={option.value}
              variant="secondary"
              className="text-xs px-2 py-0.5 gap-1"
              style={option.color ? { backgroundColor: option.color, color: '#000' } : undefined}
            >
              {option.label}
              <X
                className="h-3 w-3 cursor-pointer hover:opacity-70"
                onClick={(e) => handleRemove(option.value, e)}
              />
            </Badge>
          ))}
          {selectedOptions.length > maxDisplay && (
            <Badge variant="outline" className="text-xs px-2 py-0.5">
              +{selectedOptions.length - maxDisplay}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
