# 🛣️ RuleRoadCraft — Симулятор дорожной ситуации

> ⚠️ **RuleRoadCraft ALPHA VERSION — 0.0.7**  
> Игра находится в активной разработке. Возможны баги, неполная функциональность и частые изменения структуры.  
> Ваш фидбек очень важен! 🙌

**RuleRoadCraft** - Интерактивная веб-игра по правилам дорожного движения (ПДД РФ).  
Игрок может **создавать собственный участок дороги**, размещать элементы инфраструктуры, транспорт и участников движения, а затем запускать **симуляцию поведения** в соответствии с ПДД.

## ❤ Демо

Проверить работу игры вы можете [здесь](https://asqqqq.github.io/RuleRoadCraft/).

## 🚀 Возможности

- Кастомизация дорожной обстановки: дорога, полосы, знаки, светофоры, разметка и пр.
- Установка объектов с логикой зависимостей (например, знак не может существовать без дороги)
- Проверка на корректность размещения по ПДД
- Наблюдение за поведением участников движения
- Потенциал для обучения, геймификации и тестирования ПДД

## 📚 Структура объектов

Каждый элемент дорожной обстановки имеет категорию и родителя. Ниже представлена иерархия категорий:

| Русское название             | Кодовое имя         | Родитель               |
|-----------------------------|---------------------|------------------------|
| **Дорога**                  | `road`              | `null`                 |
| **Полоса движения**         | `lane`              | `road`                 |
| **Разметка**                | `road_marking`      | `road / lane`          |
| **Светофор**                | `traffic_light`     | `intersection / road` |
| **Перекрёсток**             | `intersection`      | `road`                 |
| **Пешеходный переход**      | `crosswalk`         | `road`                 |
| **Знак дорожный**           | `road_sign`         | `road / lane`          |
| **Транспорт**               | `vehicle`           | `lane`                 |
| **Пешеход**                 | `pedestrian`        | `crosswalk / road`     |
| **Ограждение / безопасность** | `barrier`         | `road / intersection`  |

## 🧱 Принципы

- Все объекты зависят от родительских сущностей: нельзя разместить `road_sign` без `road`, или `vehicle` без `lane`.
- Структура создаётся в виде дерева, где каждый объект "крепится" к родителю.
- Возможно расширение логики взаимодействия и проверки соблюдения ПДД.

## 🛠️ Технологии

- HTML / CSS / JS

## 💡 Применение

- Обучающие симуляции ПДД
- Интерактивные задачки по теме дорожного движения
- Визуализация ситуаций при обучении или сдаче теории
- Инструмент для автошкол или преподавателей

---

