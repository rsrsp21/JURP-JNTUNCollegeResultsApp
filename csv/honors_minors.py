import pandas as pd

# Read the CSV file into a DataFrame
df = pd.read_csv('C:/Users/rsrsp/OneDrive/Desktop/csv/2021/4_1/1.csv')

# Define the list of subject codes to extract
subject_codes_to_extract = ["204102HB","204103HE","204104MD","204142MA","204105HW","204105MF","204105MA","204101HB","204105HR"]
# Filter the DataFrame to extract rows with the specified subject codes
extracted_df = df[df['Subject Code'].isin(subject_codes_to_extract)]

# Save the filtered DataFrame to a new CSV file
extracted_df.to_csv('C:/Users/rsrsp/OneDrive/Desktop/csv/2021/honors-minors/4.csv', index=False)
