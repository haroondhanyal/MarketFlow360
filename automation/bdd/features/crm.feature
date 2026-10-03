Feature: MarketFlow360 CRM screens
  As a workspace owner
  I want to inspect CRM work screens
  So that lead and sales work is easy to manage

  Scenario Outline: dashboard loads for a workspace
    Given I selected test workspace "<workspace>"
    When I open the "Overview" screen
    Then a primary heading is displayed
    Examples:
      | workspace |
      | W1 |
      | W2 |
      | W3 |
      | W4 |
      | W5 |

  Scenario Outline: leads screen loads for a workspace
    Given I selected test workspace "<workspace>"
    When I open the "Leads" screen
    Then a primary heading is displayed
    Examples:
      | workspace |
      | W1 |
      | W2 |
      | W3 |
      | W4 |
      | W5 |

  Scenario Outline: customers screen loads for a workspace
    Given I selected test workspace "<workspace>"
    When I open the "Customers" screen
    Then a primary heading is displayed
    Examples:
      | workspace |
      | W1 |
      | W2 |
      | W3 |
      | W4 |
      | W5 |

  Scenario Outline: deals screen loads for a workspace
    Given I selected test workspace "<workspace>"
    When I open the "Deals" screen
    Then a primary heading is displayed
    Examples:
      | workspace |
      | W1 |
      | W2 |
      | W3 |
      | W4 |
      | W5 |

  Scenario Outline: tasks screen loads for a workspace
    Given I selected test workspace "<workspace>"
    When I open the "Tasks" screen
    Then a primary heading is displayed
    Examples:
      | workspace |
      | W1 |
      | W2 |
      | W3 |
      | W4 |
      | W5 |
