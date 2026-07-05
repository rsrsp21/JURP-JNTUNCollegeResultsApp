import math


def calculate_academic_summary(cgpa, regulation, supplementary_appearances=''):
    cgpa_value = _number_or_zero(cgpa)
    regulation = _normalize_regulation(regulation)
    supplementary_text = str(supplementary_appearances or '')
    supplementary_count = supplementary_text.count('*')

    percentage_value = _percentage_from_cgpa(cgpa_value, regulation)
    division, division_class = _division_from_cgpa(
        cgpa_value,
        regulation,
        has_supplementary=supplementary_count > 0,
    )

    return {
        'percentage': _format_percentage(percentage_value),
        'percentageValue': percentage_value,
        'division': division,
        'divisionClass': division_class,
        'progressPercentage': _progress_percentage(cgpa_value),
        'progressClass': _progress_class_from_cgpa(cgpa_value, regulation),
        'supplementaryCount': supplementary_count,
    }


def _percentage_from_cgpa(cgpa, regulation):
    if regulation == 'R23':
        percentage = (cgpa - 0.5) * 10
    else:
        percentage = (cgpa - 0.75) * 10
    return round(max(0.0, percentage), 2)


def _division_from_cgpa(cgpa, regulation, has_supplementary=False):
    if regulation == 'R23':
        if cgpa >= 7.5:
            return 'First Class with Distinction', 'distinction'
        if cgpa >= 6.5:
            return 'First Class', 'first'
        if cgpa >= 5.5:
            return 'Second Class', 'second'
        if cgpa >= 5:
            return 'Pass Class', 'pass'
        return 'Not Applicable', 'not-applicable'

    if cgpa >= 7.75 and not has_supplementary:
        return 'First Class with Distinction', 'distinction'
    if cgpa >= 6.75:
        return 'First Class', 'first'
    if cgpa >= 5.75:
        return 'Second Class', 'second'
    if cgpa >= 5:
        return 'Pass Class', 'pass'
    return 'Not Applicable', 'not-applicable'


def _progress_percentage(cgpa):
    return round(min(100.0, max(0.0, (cgpa / 10) * 100)), 2)


def _progress_class_from_cgpa(cgpa, regulation):
    if regulation == 'R23':
        if cgpa >= 7.5:
            return 'excellence'
        if cgpa >= 6.5:
            return 'first-class'
        if cgpa >= 5.5:
            return 'second-class'
        return 'pass-class'

    if cgpa >= 7.75:
        return 'excellence'
    if cgpa >= 6.75:
        return 'first-class'
    if cgpa >= 5.75:
        return 'second-class'
    return 'pass-class'


def _format_percentage(percentage):
    if percentage <= 0:
        return '0%'
    return f'{percentage:.2f}%'


def _normalize_regulation(regulation):
    text = str(regulation or '').strip().upper()
    return 'R23' if text == 'R23' else 'R20'


def _number_or_zero(value):
    if value is None:
        return 0.0
    if isinstance(value, float) and math.isnan(value):
        return 0.0
    try:
        return float(str(value).strip())
    except (TypeError, ValueError):
        return 0.0
