import React, { forwardRef, useState, useEffect } from 'react';
import { Input, InputProps } from '../ui/input';

interface PhoneInputProps extends Omit<InputProps, 'value' | 'onChange'> {
  value?: string;
  onChange?: (value: string) => void;
}

// Belarusian phone number mask: +375 (XX) XXX-XX-XX
const formatPhoneNumber = (inputValue: string): string => {
  // Remove all non-digit characters except +
  let digits = inputValue.replace(/\D/g, '');
  
  // Ensure country code is +375
  if (digits.startsWith('375') && !digits.startsWith('+375')) {
    digits = '+375' + digits.substring(3);
  } else if (digits.length > 0 && !digits.startsWith('+375')) {
    digits = '+375' + digits;
  }
  
  // Limit to 13 characters (+375 XX XXX-XX-XX)
  if (digits.length > 13) {
    digits = digits.substring(0, 13);
  }

  // Format as +375 (XX) XXX-XX-XX
  let formattedNumber = '+375 ';
  if (digits.length > 4) {
    formattedNumber += `(${digits.substring(4, 6)}`;
  }
  if (digits.length > 6) {
    formattedNumber += `) ${digits.substring(6, 9)}`;
  }
  if (digits.length > 9) {
    formattedNumber += `-${digits.substring(9, 11)}`;
  }
  if (digits.length > 11) {
    formattedNumber += `-${digits.substring(11, 13)}`;
  }

  return formattedNumber;
};

export const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ value = '', onChange, ...props }, ref) => {
    const [internalValue, setInternalValue] = useState(() => formatPhoneNumber(value));

    useEffect(() => {
      const formattedValue = formatPhoneNumber(value);
      if (formattedValue !== internalValue) {
        setInternalValue(formattedValue);
      }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawValue = e.target.value.replace(/\D/g, '');
      
      // Only allow valid Belarusian phone number formats (13 digits total with +375 prefix)
      if (rawValue.length <= 13) {
        const formattedValue = formatPhoneNumber(e.target.value);
        
        setInternalValue(formattedValue);
        
        if (onChange) {
          // Send the raw value to parent component
          onChange(rawValue);
        }
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      // Allow backspace and delete
      if (e.key === 'Backspace' || e.key === 'Delete') {
        // Get cursor position
        const target = e.target as HTMLInputElement;
        const cursorPosition = target.selectionStart || 0;
        
        // If cursor is at a formatting character position, prevent deletion
        if ([4, 7, 11].includes(cursorPosition) && e.key === 'Backspace') {
          // Adjust cursor position to skip formatting characters
          setTimeout(() => {
            target.setSelectionRange(cursorPosition - 1, cursorPosition - 1);
          }, 0);
        }
      }
      
      if (props.onKeyDown) props.onKeyDown(e);
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      if (props.onFocus) props.onFocus(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      if (props.onBlur) props.onBlur(e);
    };


    return (
      <Input
        ref={ref}
        type="tel"
        value={internalValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder="+375 (XX) XXX-XX-XX"
        {...props}
      />
    );
  }
);

PhoneInput.displayName = 'PhoneInput';