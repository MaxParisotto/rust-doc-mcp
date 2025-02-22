use leptos::*;
use serde::{Deserialize, Serialize};

/// Represents a todo item in our application
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct TodoItem {
    id: usize,
    title: String,
    completed: bool,
}

/// State management for our todo list
#[derive(Debug)]
pub struct TodoList {
    items: Vec<TodoItem>,
    next_id: usize,
}

impl TodoList {
    /// Creates a new empty todo list
    #[inline]
    pub fn new() -> Self {
        TodoList {
            items: Vec::new(),
            next_id: 1,
        }
    }

    /// Adds a new todo item to the list
    ///
    /// # Arguments
    /// * `title` - The title of the todo item
    ///
    /// # Returns
    /// The newly created todo item
    pub fn add_item(&mut self, title: String) -> TodoItem {
        let item = TodoItem {
            id: self.next_id,
            title,
            completed: false,
        };
        self.next_id += 1;
        self.items.push(item.clone());
        item
    }
}

/// Main component for the todo application
#[component]
pub fn TodoApp() -> impl IntoView {
    let (todos, set_todos) = create_signal(TodoList::new());
    
    let add_todo = move |title: String| {
        set_todos.update(|list| {
            list.add_item(title);
        });
    };

    view! {
        <div class="todo-app">
            <h1>"Leptos Todo App"</h1>
            <div class="todo-input">
                <input
                    type="text"
                    placeholder="What needs to be done?"
                    on:keypress=move |ev| {
                        if ev.key() == "Enter" {
                            let input = event_target_value(&ev);
                            if !input.trim().is_empty() {
                                add_todo(input);
                            }
                        }
                    }
                />
            </div>
            <ul class="todo-list">
                <For
                    each=move || todos.get().items
                    key=|todo| todo.id
                    children=move |todo| {
                        view! {
                            <li class="todo-item">
                                <input
                                    type="checkbox"
                                    checked=todo.completed
                                />
                                <span>{todo.title}</span>
                            </li>
                        }
                    }
                />
            </ul>
        </div>
    }
}

fn main() {
    mount_to_body(|| view! { <TodoApp/> })
}
