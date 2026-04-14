alter table leads
add column if not exists selected_skill_level text
check (selected_skill_level in ('first_time', 'beginner', 'intermediate', 'advanced'));
