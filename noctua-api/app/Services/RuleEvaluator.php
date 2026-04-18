<?php

namespace App\Services;

use App\Models\AlertRule;
use InvalidArgumentException;

class RuleEvaluator
{
    /**
     * Evalúa si un valor cumple la condición de la regla.
     *
     * @param float $value     Valor observado de la métrica (ej. 2500.5 ms).
     * @param string $operator Operador de comparación (debe estar en AlertRule::OPERATORS).
     * @param float $threshold Umbral definido en la regla (ej. 2000).
     *
     * @return bool true si la condición se cumple (la regla se violó), false en caso contrario.
     *
     * @throws InvalidArgumentException Si el operador no es válido.
     */
    public static function compare(float $value, string $operator, float $threshold): bool
    {
        if (!AlertRule::isValidOperator($operator)) {
            throw new InvalidArgumentException(
                "Operador inválido '{$operator}'. Permitidos: " . implode(', ', AlertRule::OPERATORS)
            );
        }

        return match ($operator) {
            '>'  => $value > $threshold,
            '<'  => $value < $threshold,
            '>=' => $value >= $threshold,
            '<=' => $value <= $threshold,
            '==' => $value === $threshold,
            '!=' => $value !== $threshold,
        };
    }

    /**
     * Evalúa directamente con un objeto AlertRule, extrayendo el operator y threshold de él.
     * Wrapper de conveniencia para uso desde el Job.
     */
    public static function evaluate(AlertRule $rule, float $value): bool
    {
        return self::compare($value, $rule->operator, (float) $rule->threshold);
    }
}