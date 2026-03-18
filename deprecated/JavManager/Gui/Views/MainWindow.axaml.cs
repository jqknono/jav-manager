using Avalonia.Controls;
using Avalonia.Input;
using Avalonia.Interactivity;
using Avalonia;
using Avalonia.VisualTree;

namespace JavManager.Gui.Views;

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
        AddHandler(InputElement.KeyDownEvent, OnPreviewKeyDown, RoutingStrategies.Tunnel);
    }

    private async void OnPreviewKeyDown(object? sender, KeyEventArgs e)
    {
        if (e.Key != Key.C || !e.KeyModifiers.HasFlag(KeyModifiers.Control))
            return;

        var topLevel = TopLevel.GetTopLevel(this);
        var focused = topLevel?.FocusManager?.GetFocusedElement();
        var textBox = focused as TextBox;
        if (textBox == null && focused is Visual visual)
        {
            var current = visual;
            while (current != null && textBox == null)
            {
                textBox = current as TextBox;
                current = current.GetVisualParent();
            }
        }

        if (textBox == null)
            return;

        // Work around a crash observed when pressing Ctrl+C inside a TextBox by handling the
        // copy gesture ourselves and preventing the default path from running.
        try
        {
            var selectedText = textBox.SelectedText;
            if (!string.IsNullOrEmpty(selectedText) && topLevel?.Clipboard != null)
            {
                await topLevel.Clipboard.SetTextAsync(selectedText);
            }
        }
        catch
        {
            // Swallow: never crash the app because clipboard copy failed.
        }
        finally
        {
            e.Handled = true;
        }
    }
}
