export class StylesHelper {
    static setStyleColors(styles: CSSStyleDeclaration, customStyles: any){
        styles.setProperty('--c-accent-high', customStyles.AccentHigh);
        styles.setProperty('--c-accent-lighter', customStyles.AccentLight);
        styles.setProperty('--c-accent-dark', customStyles.AccentDark);
        styles.setProperty('--c-text-color', customStyles.TextColor);
        styles.setProperty('--c-light-gray', customStyles.BackgroundColor);
        styles.setProperty('--c-dark-gray', customStyles.ForegroundColor);
        styles.setProperty('--c-base-gray', customStyles.FormBackgroundColor);
        styles.setProperty('--radius-base', customStyles.BorderRadius);
        styles.setProperty('--border-base', customStyles.BorderWidth);
        styles.setProperty('--font-base', customStyles.FontBaseSize);
    }
}